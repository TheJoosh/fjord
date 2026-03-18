const persistence = require("./persistence");

async function run() {
  const nextState = await persistence.recalculateAndStoreCardValues();
  const values = nextState?.valuesByName || {};
  const sample = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  console.log("Recalculation complete");
  console.log("Total population:", nextState?.totalPopulation ?? 0);
  console.log("Tracked cards:", Object.keys(values).length);
  console.log("Top values sample:", JSON.stringify(sample));
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
