"""
WebSocket Connection Manager for real-time notifications.
Tracks active connections per company and broadcasts events.
"""

from fastapi import WebSocket
from typing import Dict, List
import logging
import json
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by company_id."""

    def __init__(self):
        # company_id -> list of active WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, company_id: str):
        await websocket.accept()
        if company_id not in self.connections:
            self.connections[company_id] = []
        self.connections[company_id].append(websocket)
        logger.info(f"WS connected: company={company_id}, total={len(self.connections[company_id])}")

    def disconnect(self, websocket: WebSocket, company_id: str):
        if company_id in self.connections:
            self.connections[company_id] = [
                ws for ws in self.connections[company_id] if ws is not websocket
            ]
            if not self.connections[company_id]:
                del self.connections[company_id]
        logger.info(f"WS disconnected: company={company_id}")

    async def broadcast(self, company_id: str, event_type: str, data: dict):
        """Send an event to all connections for a given company."""
        if company_id not in self.connections:
            return

        message = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        stale = []
        for ws in self.connections[company_id]:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)

        # Clean up dead connections
        for ws in stale:
            self.disconnect(ws, company_id)


# Singleton instance used across the app
manager = ConnectionManager()
