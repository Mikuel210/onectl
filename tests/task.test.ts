import { expect, test } from "bun:test";
import { forEachConcurrent } from "../src/task";

test("forEachConcurrent defaults to bgmd's ten-task limit", async () => {
  let active = 0;
  let max = 0;

  await forEachConcurrent(
    Array.from({ length: 12 }, (_, i) => i),
    async () => {
      max = Math.max(max, ++active);
      await Bun.sleep(5);
      active--;
    },
  );

  expect(max).toBe(10);
});

test("forEachConcurrent limits simultaneous tasks and preserves indices", async () => {
  const indices: number[] = [];
  let active = 0;
  let max = 0;

  await forEachConcurrent(
    [10, 20, 30, 40],
    async (_, index) => {
      active++;
      max = Math.max(max, active);
      indices.push(index);
      await Bun.sleep(5);
      active--;
    },
    2,
  );

  expect(max).toBe(2);
  expect(indices.sort()).toEqual([0, 1, 2, 3]);
});
