import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";

const BASE = "http://localhost:3000";

// tRPC uses superjson, so data is nested under result.data.json
const getData = (res: any) => res.body?.result?.data?.json;

describe("Team Members", () => {
  let testMemberId: number;

  it("should list all team members", async () => {
    const res = await supertest(BASE).get("/api/trpc/team.list").expect(200);
    const data = getData(res);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("should have consolidated names (no duplicates)", async () => {
    const res = await supertest(BASE).get("/api/trpc/team.list").expect(200);
    const data = getData(res);
    const names = data.map((m: any) => m.nombre);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it("should have pre-seeded members (Nicolás, Josefa)", async () => {
    const res = await supertest(BASE).get("/api/trpc/team.list").expect(200);
    const data = getData(res);
    const names = data.map((m: any) => m.nombre);
    expect(names).toContain("Nicolás");
    expect(names).toContain("Josefa");
  });

  it("should create a new team member", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/team.create")
      .set("Content-Type", "application/json")
      .send({ json: { nombre: "Test Vitest Member", rol: "SETTER" } })
      .expect(200);
    const created = getData(res);
    expect(created.id).toBeGreaterThan(0);
    testMemberId = created.id;
    expect(created.nombre).toBe("Test Vitest Member");
    expect(created.rol).toBe("SETTER");
  });

  it("should update a team member name and role", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/team.update")
      .set("Content-Type", "application/json")
      .send({ json: { id: testMemberId, nombre: "Test Updated", rol: "CLOSER" } })
      .expect(200);
    const updated = getData(res);
    expect(updated.nombre).toBe("Test Updated");
    expect(updated.rol).toBe("CLOSER");
  });

  it("should deactivate a team member", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/team.update")
      .set("Content-Type", "application/json")
      .send({ json: { id: testMemberId, activo: false } })
      .expect(200);
    const updated = getData(res);
    expect(updated.activo).toBeFalsy();
  });

  it("should reactivate a team member", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/team.update")
      .set("Content-Type", "application/json")
      .send({ json: { id: testMemberId, activo: true } })
      .expect(200);
    const updated = getData(res);
    expect(updated.activo).toBeTruthy();
  });

  it("should filter by role via list", async () => {
    const res = await supertest(BASE).get("/api/trpc/team.list").expect(200);
    const data = getData(res);
    const setters = data.filter((m: any) => m.rol === "SETTER" || m.rol === "SETTER_CLOSER");
    const closers = data.filter((m: any) => m.rol === "CLOSER" || m.rol === "SETTER_CLOSER");
    expect(setters.length).toBeGreaterThan(0);
    expect(closers.length).toBeGreaterThan(0);
  });

  // Cleanup
  afterAll(async () => {
    if (testMemberId) {
      await supertest(BASE)
        .post("/api/trpc/team.delete")
        .set("Content-Type", "application/json")
        .send({ json: { id: testMemberId } });
    }
  });
});
