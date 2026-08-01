import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "../page";

describe("Home page", () => {
  it("renders the game title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /northbound/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders the principles section", () => {
    render(<Home />);
    expect(
      screen.getByRole("region", { name: /product principles/i }),
    ).toBeInTheDocument();
  });
});
