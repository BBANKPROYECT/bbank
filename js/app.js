// --- CONFIGURACIÓN DE DIRECCIONES DE CONTRATOS ---
// ⚠️ Reemplaza estas direcciones con las que te genere Remix tras el despliegue
const BANK_MAIN_CONTRACT = "0x0000000000000000000000000000000000000000"; // Contrato BBANK
const EBANK_CONTRACT = "0x0000000000000000000000000000000000000000";     // Contrato EBANK
const BNBANK_CONTRACT = "0x0000000000000000000000000000000000000000";    // Contrato BNBANK

// ABIs mínimos unificados para interactuar con las funciones del ecosistema BANK
const contractABI = [
    "function buyTokensDirect() external payable",
    "function calculateTokensPerBNB(uint256) view returns (uint256)",
    "function getLatestBTCPrice() view returns (int256)"
];

let provider, signer, contract;

// Referencias de elementos de la interfaz en el DOM
const connectBtn = document.getElementById("connectBtn");
const buyBtn = document.getElementById("buyBtn");
const bnbInput = document.getElementById("bnbInput");
const addTokensBtn = document.getElementById("addTokensBtn");
const walletAddress = document.getElementById("walletAddress");
const globalStatus = document.getElementById("globalStatus");

/**
 * Carga inicial para mostrar los precios de Chainlink directamente en los cards si se desea extender
 */
async function initPrices() {
    if (window.ethereum) {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            const tempContract = new ethers.Contract(BANK_MAIN_CONTRACT, contractABI, provider);
            
            // Consumir el precio base del oráculo (Bitcoin)
            const btcRaw = await tempContract.getLatestBTCPrice();
            
            // Si tienes elementos en el HTML para mostrar los precios globales de mercado:
            if (document.getElementById("btcPrice")) {
                document.getElementById("btcPrice").innerText = `$${(Number(btcRaw) / 10**8).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            }
            updateStatus("Oráculos de Chainlink sincronizados correctamente.", "green");
        } catch (error) {
            console.error("Error al inicializar precios:", error);
            updateStatus("Configura las direcciones de los contratos para activar la lectura en vivo.", "orange");
        }
    } else {
        updateStatus("MetaMask no detectado. Instala la extensión para operar en el Swap.", "orange");
    }
}

/**
 * Conexión nativa con MetaMask y activación del panel de control
 */
async function connectWallet() {
    if (!window.ethereum) {
        updateStatus("Por favor, instala MetaMask para continuar.", "red");
        return;
    }
    try {
        updateStatus("Enlazando cuenta...", "orange");
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        
        const userAddr = await signer.getAddress();
        walletAddress.innerText = `Billetera: ${userAddr}`;
        connectBtn.innerText = "Conectado ✔";
        connectBtn.style.backgroundColor = "#10b981";
        
        contract = new ethers.Contract(BANK_MAIN_CONTRACT, contractABI, signer);
        buyBtn.disabled = false;
        
        if (addTokensBtn) {
            addTokensBtn.classList.remove("hidden");
        }
        
        updateStatus("Listo para operar en el Swap Directo de BANK.", "green");
    } catch (error) {
        console.error(error);
        updateStatus("Error de autenticación al conectar MetaMask.", "red");
    }
}

/**
 * Cotizador automático en tiempo real basado en el input de BNB introducido por el usuario
 */
async function updateEstimates() {
    const bnbValue = parseFloat(bnbInput.value);
    
    // El mínimo debe ser superior a la tasa fija del propietario (0.1 BNB)
    if (isNaN(bnbValue) || bnbValue <= 0.1) {
        if (document.getElementById("estTRIPL")) document.getElementById("estTRIPL").innerText = "0.00"; // IDs del index.html antiguo si no se cambian
        if (document.getElementById("estTRIPLa")) document.getElementById("estTRIPLa").innerText = "0.00";
        if (document.getElementById("estTRIPLb")) document.getElementById("estTRIPLb").innerText = "0.00";
        
        // Elementos con los nuevos nombres si actualizaste las etiquetas de texto
        if (document.getElementById("estBBANK")) document.getElementById("estBBANK").innerText = "0.00";
        if (document.getElementById("estEBANK")) document.getElementById("estEBANK").innerText = "0.00";
        if (document.getElementById("estBNBANK")) document.getElementById("estBNBANK").innerText = "0.00";
        return;
    }

    try {
        // Restar los 0.1 BNB retenidos del Owner antes de calcular el minteo elástico
        const bnbForTokens = ethers.parseEther((bnbValue - 0.1).toFixed(18));
        const baseAmountRaw = await contract.calculateTokensPerBNB(bnbForTokens);
        const baseAmount = parseFloat(ethers.formatEther(baseAmountRaw));

        // Actualizar estimaciones dinámicas (+200% incluido en el token principal)
        const targetBBANK = document.getElementById("estBBANK") || document.getElementById("estTRIPL");
        const targetEBANK = document.getElementById("estEBANK") || document.getElementById("estTRIPLa");
        const targetBNBANK = document.getElementById("estBNBANK") || document.getElementById("estTRIPLb");

        if (targetBBANK) targetBBANK.innerText = (baseAmount * 3).toFixed(4);
        if (targetEBANK) targetEBANK.innerText = baseAmount.toFixed(4);
        if (targetBNBANK) targetBNBANK.innerText = baseAmount.toFixed(4);

    } catch (error) {
        console.error("Error al calcular la cotización:", error);
    }
}

/**
 * Envío de fondos y ejecución de la compra sin intermediarios
 */
async function executePurchase() {
    const bnbValue = bnbInput.value;
    if (!bnbValue || parseFloat(bnbValue) <= 0.1) {
        updateStatus("Monto insuficiente. Recuerda que la comisión base para el Owner es de 0.1 BNB.", "red");
        return;
    }

    try {
        updateStatus("Confirmando transacción en tu MetaMask...", "orange");
        buyBtn.disabled = true;

        const txValue = ethers.parseEther(bnbValue);
        
        // Llamada directa al método de Venta Directa del contrato madre
        const tx = await contract.buyTokensDirect({ value: txValue });

        updateStatus("Procesando bloque en la red... Por favor espera confirmación.", "orange");
        await tx.wait();

        updateStatus("¡Éxito total! Toda la tripleta BANK ha sido minteada en tu billetera.", "green");
        bnbInput.value = "";
        updateEstimates();
    } catch (error) {
        console.error(error);
        updateStatus("La transacción fue cancelada por el usuario o rechazada.", "red");
    } finally {
        buyBtn.disabled = false;
    }
}

/**
 * Importación automática de los 3 nuevos activos (BBANK, EBANK, BNBANK) a MetaMask
 */
async function watchAllTokens() {
    if (!window.ethereum) return;
    
    const tokens = [
        { address: BANK_MAIN_CONTRACT, symbol: "BBANK" },
        { address: EBANK_CONTRACT, symbol: "EBANK" },
        { address: BNBANK_CONTRACT, symbol: "BNBANK" }
    ];

    try {
        updateStatus("Por favor acepta las solicitudes consecutivas de MetaMask...", "orange");
        
        for (const token of tokens) {
            await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: { 
                    type: 'ERC20', 
                    options: { 
                        address: token.address, 
                        symbol: token.symbol, 
                        decimals: 18 
                    } 
                }
            });
        }
        updateStatus("¡Ecosistema BANK importado con éxito a tu MetaMask!", "green");
    } catch (error) {
        console.error(error);
        updateStatus("La importación de tokens fue cancelada.", "red");
    }
}

/**
 * Manejador visual de mensajes de estado
 */
function updateStatus(text, color) {
    globalStatus.innerText = text;
    if (color === "red") globalStatus.style.color = "#f87171";
    if (color === "green") globalStatus.style.color = "#34d399";
    if (color === "orange") globalStatus.style.color = "#fbbf24";
}

// Eventos y escuchadores globales
connectBtn.addEventListener("click", connectWallet);
bnbInput.addEventListener("input", updateEstimates);
buyBtn.addEventListener("click", executePurchase);
if (addTokensBtn) addTokensBtn.addEventListener("click", watchAllTokens);

// Inicializar oráculos al cargar el documento
window.addEventListener("load", initPrices);
