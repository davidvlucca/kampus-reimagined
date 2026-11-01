import { Component, type ReactNode } from "react";

/** Se a cena 3D rebentar (shader, driver, memória), avisa e deixa a visita seguir em 2D. */
export class Tour3DErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
