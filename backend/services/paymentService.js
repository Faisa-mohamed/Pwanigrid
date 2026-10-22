// Only SIMULATION exists. A real provider (for example M-Pesa Daraja) plugs in here later.
const mode = () => process.env.PAYMENT_MODE || "simulation";
const simulationEnabled = () => mode() === "simulation";

async function initiatePayment({ purchaseId }) {
  if (simulationEnabled()) {
    return { provider: "simulation", reference: `SIM-${purchaseId}`, simulated: true };
  }
  throw new Error("Real payment provider is not configured");
}

module.exports = { initiatePayment, simulationEnabled };