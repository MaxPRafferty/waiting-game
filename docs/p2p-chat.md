# P2P Neighborhood Chat

Peer-to-peer chat via [Trystero](https://github.com/dmotz/trystero) (BitTorrent transport). No server relay — messages go directly between browsers in the same neighborhood.

## Neighborhoods

The queue is divided into 100-slot neighborhoods. When `scrollOffset` crosses a boundary (`Math.floor(scrollOffset / 100)`), the client leaves the current Trystero room and joins the new one. Room IDs follow the pattern `neighborhood-{bucketId}`.

## NAT/ICE behavior

Trystero uses WebRTC under the hood. Connection success depends on NAT type:

- **Full cone / restricted cone NAT:** peers connect directly via STUN.
- **Symmetric NAT (common on mobile/corporate networks):** direct connection may fail. WebRTC falls back to TURN if available, but Trystero's BitTorrent transport does not provide TURN servers by default.
- **Firewalled environments:** connections will fail silently.

## Failure handling

If Trystero fails to load or initialize (network issues, ad blockers, corporate firewalls), the chat panel shows "Chat unavailable in this neighborhood" and disables the input field. The rest of the app continues to function normally — chat is a non-critical feature.

## Room switching

Room switches are instantaneous from the user's perspective. On switch:
1. `p2pRoom.leave()` disconnects from all current peers
2. `joinRoom()` connects to the new neighborhood
3. Chat log clears and shows "Entered neighborhood N"
4. Peer count resets to 0

There is no message persistence across room switches.
