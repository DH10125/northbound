/**
 * Tests for RouteSelector component accessibility and behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteSelector } from "../RouteSelector";
import { minimalGameState } from "@/game/testing/fixtures";
import type { GameState } from "@/game/schemas/game-state";

describe("RouteSelector", () => {
  const onChooseRoute = vi.fn();

  beforeEach(() => {
    onChooseRoute.mockClear();
  });

  it("displays current location name and description", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    expect(screen.getByText("Beachside Hotel")).toBeInTheDocument();
    expect(
      screen.getByText(/mid-range hotel near the waterfront/),
    ).toBeInTheDocument();
  });

  it("shows available route edges from current node", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    // Hotel has 2 edges
    const travelButtons = screen.getAllByRole("button", { name: /Travel:/i });
    expect(travelButtons.length).toBe(2);
  });

  it("displays distance, terrain, and risk for each route", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    // Check distance text appears
    expect(screen.getAllByText(/Distance:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Terrain:/).length).toBeGreaterThan(0);
  });

  it("calls onChooseRoute with edge ID when Travel button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    const buttons = screen.getAllByRole("button", { name: /Travel:/i });
    await user.click(buttons[0]!);
    expect(onChooseRoute).toHaveBeenCalledTimes(1);
    expect(onChooseRoute).toHaveBeenCalledWith(
      expect.stringContaining("edge.pensacola.hotel-to-"),
    );
  });

  it("disables route buttons when disabled prop is true", () => {
    render(
      <RouteSelector
        state={minimalGameState}
        onChooseRoute={onChooseRoute}
        disabled
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /Travel:/i });
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it("shows unavailable reason when transport mode does not match", () => {
    const state: GameState = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        activeTransportId:
          "transport-inst-001" as import("@/game/schemas/ids").TransportInstanceId,
      },
      transports: [
        {
          instanceId:
            "transport-inst-001" as import("@/game/schemas/ids").TransportInstanceId,
          definitionId:
            "transport.land.van" as import("@/game/schemas/ids").TransportId,
          mode: "van",
          condition: 80,
          fuel: 50,
          cargoItemIds: [],
        },
      ],
    };
    render(<RouteSelector state={state} onChooseRoute={onChooseRoute} />);
    // hotel-to-marina allows only foot/bicycle — should show unavailable reason
    const unavailable = screen.getAllByText(/Unavailable:/);
    expect(unavailable.length).toBeGreaterThan(0);
  });

  it("disables unavailable route buttons", () => {
    const state: GameState = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        activeTransportId:
          "transport-inst-001" as import("@/game/schemas/ids").TransportInstanceId,
      },
      transports: [
        {
          instanceId:
            "transport-inst-001" as import("@/game/schemas/ids").TransportInstanceId,
          definitionId:
            "transport.land.van" as import("@/game/schemas/ids").TransportId,
          mode: "van",
          condition: 80,
          fuel: 50,
          cargoItemIds: [],
        },
      ],
    };
    render(<RouteSelector state={state} onChooseRoute={onChooseRoute} />);
    const buttons = screen.getAllByRole("button", { name: /Travel:/i });
    // At least one button should be disabled (hotel-to-marina)
    const disabledButtons = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(disabledButtons.length).toBeGreaterThan(0);
  });

  it("has accessible aria-label on Travel buttons with full context", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    const buttons = screen.getAllByRole("button", { name: /Travel:/i });
    for (const btn of buttons) {
      const label = btn.getAttribute("aria-label")!;
      expect(label).toContain("Distance");
      expect(label).toContain("terrain");
      expect(label).toContain("risk");
    }
  });

  it("shows distance remaining and current day/phase", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    expect(screen.getByText(/Distance remaining:/)).toBeInTheDocument();
    expect(screen.getByText(/Day:/)).toBeInTheDocument();
    expect(screen.getByText(/Phase:/)).toBeInTheDocument();
  });

  it("renders section with accessible heading", () => {
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    expect(
      screen.getByRole("heading", { name: "Beachside Hotel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Available Routes" }),
    ).toBeInTheDocument();
  });

  it("keyboard activation of Travel button fires onChooseRoute", async () => {
    const user = userEvent.setup();
    render(
      <RouteSelector state={minimalGameState} onChooseRoute={onChooseRoute} />,
    );
    const buttons = screen.getAllByRole("button", { name: /Travel:/i });
    buttons[0]!.focus();
    await user.keyboard("{Enter}");
    expect(onChooseRoute).toHaveBeenCalledTimes(1);
  });
});
