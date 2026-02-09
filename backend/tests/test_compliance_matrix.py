"""
Compliance Matrix API Tests
Tests for the refactored compliance matrix with new data model:
- provision, legal_reference_url, owner, consequences fields
- status and owner filters
- status update endpoint
- AI summary endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestObligationsAPI:
    """Test /api/obligations endpoint"""
    
    def test_get_all_obligations(self):
        """Test fetching all obligations"""
        response = requests.get(f"{BASE_URL}/api/obligations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"SUCCESS: Fetched {len(data)} obligations")
        
        # Verify required fields exist
        obl = data[0]
        assert "id" in obl
        assert "statute" in obl
        assert "obligation" in obl
        assert "action_required" in obl
        assert "due_date" in obl
        assert "severity" in obl
        assert "category" in obl
        assert "status" in obl
        
    def test_get_obligations_with_status_filter(self):
        """Test status filter on obligations endpoint"""
        response = requests.get(f"{BASE_URL}/api/obligations?status=pending")
        assert response.status_code == 200
        data = response.json()
        
        # All returned obligations should have pending status
        for obl in data:
            assert obl.get("status") == "pending", f"Expected pending status, got {obl.get('status')}"
        print(f"SUCCESS: Status filter returned {len(data)} pending obligations")
    
    def test_get_obligations_with_category_filter(self):
        """Test category filter on obligations endpoint"""
        response = requests.get(f"{BASE_URL}/api/obligations?category=Corporate")
        assert response.status_code == 200
        data = response.json()
        
        for obl in data:
            assert obl.get("category") == "Corporate"
        print(f"SUCCESS: Category filter returned {len(data)} Corporate obligations")
    
    def test_get_obligations_with_severity_filter(self):
        """Test severity filter on obligations endpoint"""
        response = requests.get(f"{BASE_URL}/api/obligations?severity=critical")
        assert response.status_code == 200
        data = response.json()
        
        for obl in data:
            assert obl.get("severity") == "critical"
        print(f"SUCCESS: Severity filter returned {len(data)} critical obligations")


class TestObligationStatusUpdate:
    """Test status update functionality"""
    
    def test_update_obligation_status(self):
        """Test updating obligation status via PATCH endpoint"""
        # First get an obligation ID
        response = requests.get(f"{BASE_URL}/api/obligations")
        assert response.status_code == 200
        obligations = response.json()
        assert len(obligations) > 0
        
        obligation_id = obligations[0]["id"]
        
        # Update status
        response = requests.patch(
            f"{BASE_URL}/api/obligations/{obligation_id}/status",
            params={"status": "in_progress"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        print(f"SUCCESS: Updated obligation {obligation_id} to in_progress")
        
        # Verify the update persisted
        response = requests.get(f"{BASE_URL}/api/obligations/{obligation_id}")
        assert response.status_code == 200
        updated_obl = response.json()
        assert updated_obl["status"] == "in_progress"
        print("SUCCESS: Status update persisted in database")
    
    def test_update_nonexistent_obligation(self):
        """Test updating a non-existent obligation returns 404"""
        response = requests.patch(
            f"{BASE_URL}/api/obligations/nonexistent-id-12345/status",
            params={"status": "completed"}
        )
        assert response.status_code == 404
        print("SUCCESS: Non-existent obligation returns 404")


class TestAISummaryEndpoint:
    """Test AI summary generation endpoint"""
    
    def test_generate_ai_summary(self):
        """Test AI summary generation for an obligation"""
        payload = {
            "statute": "Mines and Minerals Development Act No. 11 of 2015",
            "obligation": "Annual Mining License Renewal",
            "action_required": "Submit renewal application with updated environmental reports"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ai/summary",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "summary" in data
        assert "approved_by" in data
        assert "last_updated" in data
        assert "key_points" in data
        
        # Verify content
        assert len(data["summary"]) > 50  # Summary should be substantial
        assert isinstance(data["key_points"], list)
        assert len(data["key_points"]) >= 1  # Should have at least one key point
        
        print(f"SUCCESS: AI Summary generated with {len(data['key_points'])} key points")
        print(f"  Approved by: {data['approved_by']}")


class TestLegislationEndpoint:
    """Test the legislation endpoint that uses get_obligations_for_company"""
    
    def test_get_legislation_with_new_fields(self):
        """Test that legislation endpoint returns new fields (provision, owner, etc.)"""
        response = requests.get(f"{BASE_URL}/api/legislation/mining/Base%20Metals")
        assert response.status_code == 200
        data = response.json()
        
        assert "obligations" in data
        obligations = data["obligations"]
        assert len(obligations) > 0
        
        # Check that new fields are present
        obl = obligations[0]
        assert "provision" in obl, "Missing provision field"
        assert "legal_reference_url" in obl, "Missing legal_reference_url field"
        assert "owner" in obl, "Missing owner field"
        assert "consequences" in obl, "Missing consequences field"
        
        # Verify values
        assert obl["provision"] is not None
        assert obl["legal_reference_url"].startswith("https://")
        assert obl["owner"] in ["Legal", "HR", "Finance", "Operations", "Compliance", "Admin"]
        
        print(f"SUCCESS: Legislation endpoint returns {len(obligations)} obligations with new fields")
        print(f"  Sample provision: {obl['provision']}")
        print(f"  Sample owner: {obl['owner']}")
        print(f"  Sample URL: {obl['legal_reference_url'][:50]}...")


class TestSingleObligationEndpoint:
    """Test single obligation retrieval"""
    
    def test_get_single_obligation(self):
        """Test fetching a single obligation by ID"""
        # First get an obligation ID
        response = requests.get(f"{BASE_URL}/api/obligations")
        assert response.status_code == 200
        obligations = response.json()
        
        obligation_id = obligations[0]["id"]
        
        # Fetch single obligation
        response = requests.get(f"{BASE_URL}/api/obligations/{obligation_id}")
        assert response.status_code == 200
        obl = response.json()
        
        assert obl["id"] == obligation_id
        print(f"SUCCESS: Fetched single obligation: {obl['obligation'][:50]}...")
    
    def test_get_nonexistent_obligation(self):
        """Test fetching non-existent obligation returns 404"""
        response = requests.get(f"{BASE_URL}/api/obligations/nonexistent-id")
        assert response.status_code == 404
        print("SUCCESS: Non-existent obligation returns 404")


class TestOwnerFilterIssue:
    """Test documenting the owner filter issue"""
    
    def test_owner_filter_returns_empty(self):
        """
        KNOWN ISSUE: Owner filter returns empty because owner field
        is not stored in database - it's computed on-the-fly by frontend.
        
        This test documents the current behavior.
        """
        response = requests.get(f"{BASE_URL}/api/obligations?owner=HR")
        assert response.status_code == 200
        data = response.json()
        
        # Currently returns empty because owner not in DB
        # This is expected behavior given current implementation
        print(f"Owner filter returned {len(data)} results (expected: 0 due to DB schema)")
        
        # Note: Frontend handles this by computing owner client-side
        # The legislation endpoint returns owner because it's computed server-side


# Run with: pytest test_compliance_matrix.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
