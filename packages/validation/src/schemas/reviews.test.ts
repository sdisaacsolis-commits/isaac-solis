import { describe, expect, it } from "vitest";

import {
  moderateReviewSchema,
  replyToReviewSchema,
  reportReviewSchema,
  submitReviewSchema,
  updateMyReviewSchema,
} from "./reviews";

const uuid = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("submitReviewSchema", () => {
  it("acepta una reseña válida", () => {
    expect(
      submitReviewSchema.safeParse({
        appointmentId: uuid,
        rating: 5,
        body: "Trato excelente y explicación clara.",
      }).success,
    ).toBe(true);
  });

  it("exige calificación de 1 a 5", () => {
    expect(
      submitReviewSchema.safeParse({ appointmentId: uuid, rating: 0, body: "hola" }).success,
    ).toBe(false);
    expect(
      submitReviewSchema.safeParse({ appointmentId: uuid, rating: 6, body: "hola" }).success,
    ).toBe(false);
  });

  it("exige cuerpo mínimo", () => {
    expect(
      submitReviewSchema.safeParse({ appointmentId: uuid, rating: 4, body: "ab" }).success,
    ).toBe(false);
  });

  it("rechaza cita manipulada", () => {
    expect(
      submitReviewSchema.safeParse({ appointmentId: "1; drop", rating: 4, body: "buena" }).success,
    ).toBe(false);
  });
});

describe("updateMyReviewSchema", () => {
  it("usa reviewId en lugar de appointmentId", () => {
    expect(
      updateMyReviewSchema.safeParse({ reviewId: uuid, rating: 3, body: "cambio" }).success,
    ).toBe(true);
    expect(
      updateMyReviewSchema.safeParse({ appointmentId: uuid, rating: 3, body: "cambio" }).success,
    ).toBe(false);
  });
});

describe("replyToReviewSchema y reportReviewSchema", () => {
  it("la respuesta exige texto", () => {
    expect(replyToReviewSchema.safeParse({ reviewId: uuid, reply: " " }).success).toBe(false);
    expect(replyToReviewSchema.safeParse({ reviewId: uuid, reply: "Gracias" }).success).toBe(true);
  });
  it("el reporte exige motivo", () => {
    expect(reportReviewSchema.safeParse({ reviewId: uuid, reason: "ab" }).success).toBe(false);
    expect(
      reportReviewSchema.safeParse({ reviewId: uuid, reason: "Contenido falso" }).success,
    ).toBe(true);
  });
});

describe("moderateReviewSchema", () => {
  it("exige motivo para ocultar o restaurar", () => {
    expect(
      moderateReviewSchema.safeParse({ reviewId: uuid, hidden: true, reason: "x" }).success,
    ).toBe(false);
    expect(
      moderateReviewSchema.safeParse({ reviewId: uuid, hidden: true, reason: "Lenguaje ofensivo" })
        .success,
    ).toBe(true);
  });
});
