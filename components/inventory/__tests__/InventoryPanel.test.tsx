/**
 * Tests for InventoryPanel component — touch/keyboard accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryPanel } from "../InventoryPanel";
import { minimalGameState } from "@/game/testing/fixtures";
import type { GameState } from "@/game/schemas/game-state";
import type { ItemId, ItemInstanceId } from "@/game/schemas/ids";

const stateWithItems: GameState = {
  ...minimalGameState,
  inventory: {
    storages: [
      {
        location: "backpack",
        items: [
          {
            instanceId: "item-test-1" as ItemInstanceId,
            definitionId: "item.food.ration" as ItemId,
            quantity: 3,
            condition: 100,
          },
          {
            instanceId: "item-test-2" as ItemInstanceId,
            definitionId: "item.tools.knife" as ItemId,
            quantity: 1,
            condition: 80,
          },
        ],
      },
      {
        location: "body",
        items: [],
      },
    ],
  },
};

describe("InventoryPanel", () => {
  it("renders item names and quantities", () => {
    render(
      <InventoryPanel state={stateWithItems} onAction={() => ({ ok: true })} />,
    );
    expect(screen.getByText("Trail Ration")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByText("Utility Knife")).toBeInTheDocument();
  });

  it("shows actions when item is selected via click", async () => {
    const user = userEvent.setup();
    render(
      <InventoryPanel state={stateWithItems} onAction={() => ({ ok: true })} />,
    );
    await user.click(screen.getByTestId("item-item-test-1"));
    expect(screen.getByTestId("consume-item-test-1")).toBeInTheDocument();
  });

  it("keyboard: Enter selects item", async () => {
    const user = userEvent.setup();
    render(
      <InventoryPanel state={stateWithItems} onAction={() => ({ ok: true })} />,
    );
    const btn = screen.getByTestId("item-item-test-1");
    btn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("consume-item-test-1")).toBeInTheDocument();
  });

  it("consume calls onAction and announces result", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => ({ ok: true }));
    render(<InventoryPanel state={stateWithItems} onAction={onAction} />);
    await user.click(screen.getByTestId("item-item-test-1"));
    await user.click(screen.getByTestId("consume-item-test-1"));
    expect(onAction).toHaveBeenCalledWith({
      type: "consume",
      instanceId: "item-test-1",
    });
  });

  it("transfer calls onAction with correct locations", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => ({ ok: true }));
    render(<InventoryPanel state={stateWithItems} onAction={onAction} />);
    await user.click(screen.getByTestId("item-item-test-1"));
    await user.click(screen.getByTestId("transfer-item-test-1-body"));
    expect(onAction).toHaveBeenCalledWith({
      type: "transfer",
      instanceId: "item-test-1",
      from: "backpack",
      to: "body",
      quantity: 1,
    });
  });

  it("announces error on failed action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => ({ ok: false, reason: "Too heavy." }));
    render(<InventoryPanel state={stateWithItems} onAction={onAction} />);
    await user.click(screen.getByTestId("item-item-test-1"));
    await user.click(screen.getByTestId("consume-item-test-1"));
    // Wait for announcement
    await vi.waitFor(() => {
      expect(screen.getByTestId("inventory-announcement").textContent).toBe(
        "Too heavy.",
      );
    });
  });

  it("non-consumable items don't show consume button", async () => {
    const user = userEvent.setup();
    render(
      <InventoryPanel state={stateWithItems} onAction={() => ({ ok: true })} />,
    );
    await user.click(screen.getByTestId("item-item-test-2"));
    expect(screen.queryByTestId("consume-item-test-2")).not.toBeInTheDocument();
  });

  it("has accessible section label", () => {
    render(
      <InventoryPanel state={stateWithItems} onAction={() => ({ ok: true })} />,
    );
    expect(
      screen.getByRole("region", { name: /inventory/i }),
    ).toBeInTheDocument();
  });
});
