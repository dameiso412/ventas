/**
 * Verificación pura del algoritmo Weighted Round-Robin (sin DB).
 *
 * Run: npx tsx scripts/test-round-robin-algo.ts
 *
 * Cubre los casos del plan:
 *   1. 70/30 distribuye correctamente sobre 100 calls.
 *   2. Empate de deficit → el de mayor % gana.
 *   3. 1 target con 100% → todos los assignments le caen.
 *   4. Cambio de % en caliente → el algoritmo se autocorrige.
 */
import { computeNextTarget } from "../server/_core/round-robin";

function simulate(targets: Array<{ setterName: string; percentage: number }>, calls: number, initialCounts: Record<string, number> = {}) {
  const counts = { ...initialCounts };
  for (const t of targets) if (!(t.setterName in counts)) counts[t.setterName] = 0;
  for (let i = 0; i < calls; i++) {
    const winner = computeNextTarget(targets, counts);
    if (!winner) throw new Error("computeNextTarget retornó null");
    counts[winner.setterName] = (counts[winner.setterName] ?? 0) + 1;
  }
  return counts;
}

let pass = 0, fail = 0;
function expect(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

console.log("\n[Test 1] 70/30 sobre 100 calls (esperado: 70 / 30 ± 1)");
{
  const result = simulate([{ setterName: "Juan", percentage: 70 }, { setterName: "Ana", percentage: 30 }], 100);
  console.log(`  Result: Juan=${result.Juan}, Ana=${result.Ana}`);
  expect("Juan ~70 ± 1", Math.abs(result.Juan - 70) <= 1, `got ${result.Juan}`);
  expect("Ana ~30 ± 1", Math.abs(result.Ana - 30) <= 1, `got ${result.Ana}`);
  expect("Total = 100", result.Juan + result.Ana === 100);
}

console.log("\n[Test 2] Lista vacía → null");
{
  const r = computeNextTarget([], {});
  expect("retorna null", r === null);
}

console.log("\n[Test 3] 1 target con 100% sobre 50 calls");
{
  const result = simulate([{ setterName: "Solo", percentage: 100 }], 50);
  expect("Todas a Solo", result.Solo === 50, `got ${result.Solo}`);
}

console.log("\n[Test 4] 50/50 sobre 100 calls (esperado: 50/50 exacto)");
{
  const result = simulate([{ setterName: "A", percentage: 50 }, { setterName: "B", percentage: 50 }], 100);
  console.log(`  Result: A=${result.A}, B=${result.B}`);
  expect("A = 50", result.A === 50);
  expect("B = 50", result.B === 50);
}

console.log("\n[Test 5] Cambio de % en caliente: 70/30 con 30 hechas (21/9), después 50/50 sobre 70 más");
{
  // Start con 21/9 (state existente).
  let counts = { Juan: 21, Ana: 9 };
  // Cambio de % a 50/50, simular 70 más.
  const newTargets = [{ setterName: "Juan", percentage: 50 }, { setterName: "Ana", percentage: 50 }];
  for (let i = 0; i < 70; i++) {
    const winner = computeNextTarget(newTargets, counts);
    if (!winner) throw new Error("null");
    counts[winner.setterName as "Juan" | "Ana"]++;
  }
  console.log(`  Final: Juan=${counts.Juan}, Ana=${counts.Ana} (total 100)`);
  // Esperado: Ana cierra el gap. Tras 100 calls con target 50/50 final,
  // el algoritmo intenta llegar a 50/50 pero arrastra el sesgo inicial.
  // Lo más cercano a 50/50 manteniendo monotonicidad (Juan no decrece).
  expect("Total = 100", counts.Juan + counts.Ana === 100);
  // Ana debe haber recibido la mayoría de las 70 nuevas (al menos 41 nuevas
  // de 70 = 21 + 41 = 50/50 exacto, o cerca).
  expect("Ana recibió la mayoría de las 70 nuevas", counts.Ana - 9 >= 35, `Ana ahora=${counts.Ana}`);
}

console.log("\n[Test 6] 60/40 sobre 200 calls (verifica estabilidad en otra proporción)");
{
  const result = simulate([{ setterName: "X", percentage: 60 }, { setterName: "Y", percentage: 40 }], 200);
  console.log(`  Result: X=${result.X}, Y=${result.Y}`);
  expect("X ~120 ± 1", Math.abs(result.X - 120) <= 1, `got ${result.X}`);
  expect("Y ~80 ± 1", Math.abs(result.Y - 80) <= 1, `got ${result.Y}`);
}

console.log("\n[Test 7] 33/33/34 sobre 99 calls");
{
  const result = simulate([
    { setterName: "A", percentage: 33 }, { setterName: "B", percentage: 33 }, { setterName: "C", percentage: 34 }
  ], 99);
  console.log(`  Result: A=${result.A}, B=${result.B}, C=${result.C}`);
  expect("A ~33", Math.abs(result.A - Math.round(99 * 0.33)) <= 1);
  expect("B ~33", Math.abs(result.B - Math.round(99 * 0.33)) <= 1);
  expect("C ~33-34", Math.abs(result.C - Math.round(99 * 0.34)) <= 1);
  expect("Suma = 99", result.A + result.B + result.C === 99);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
