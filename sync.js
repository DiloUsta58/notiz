/**
 * Cloud-Sync Basis (Stub)
 *
 * Ziel: Sync später austauschbar nachrüsten (WebDAV/S3/Firebase/Drive…),
 * ohne das Datenmodell/Editor-UI zu zerreißen.
 *
 * Aktuell bewusst ohne Implementierung, weil Browser-Auth/Network-Handling
 * je nach Provider stark variiert.
 */

export class SyncProvider {
  /** @param {{exportJson: () => Promise<string>, importJson: (payload:any) => Promise<void>}} deps */
  constructor(deps) {
    this.deps = deps;
  }

  /** Push local state to remote */
  async push() {
    throw new Error("Not implemented");
  }

  /** Pull remote state into local */
  async pull() {
    throw new Error("Not implemented");
  }
}

