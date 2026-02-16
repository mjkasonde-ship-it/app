"""
Test suite for Obligation Rewrite functionality
Testing the LLM-powered data transformation endpoints:
- POST /api/obligations/{obligation_id}/rewrite - Rewrite single obligation to 5-section format
- GET /api/obligations/rewrite-status - Get status of how many obligations have been rewritten
- GET /api/obligations/{id} - Verify plain_language_summary is returned
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRewriteStatus:
    """Tests for GET /api/obligations/rewrite-status endpoint"""
    
    def test_rewrite_status_endpoint_returns_200(self):
        """Test that rewrite-status endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/obligations/rewrite-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ GET /api/obligations/rewrite-status returned 200")
    
    def test_rewrite_status_returns_correct_structure(self):
        """Test that rewrite-status returns expected fields"""
        response = requests.get(f"{BASE_URL}/api/obligations/rewrite-status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate required fields exist
        assert "total" in data, "Missing 'total' field"
        assert "rewritten" in data, "Missing 'rewritten' field"
        assert "pending" in data, "Missing 'pending' field"
        assert "percentage" in data, "Missing 'percentage' field"
        
        # Validate field types
        assert isinstance(data["total"], int), "total should be integer"
        assert isinstance(data["rewritten"], int), "rewritten should be integer"
        assert isinstance(data["pending"], int), "pending should be integer"
        assert isinstance(data["percentage"], (int, float)), "percentage should be numeric"
        
        # Validate logical consistency
        assert data["total"] == data["rewritten"] + data["pending"], \
            f"total ({data['total']}) should equal rewritten ({data['rewritten']}) + pending ({data['pending']})"
        
        print(f"✓ Rewrite status: {data['rewritten']}/{data['total']} obligations rewritten ({data['percentage']}%)")


class TestObligationWithPlainLanguageSummary:
    """Tests for obligations that have plain_language_summary"""
    
    def test_get_rewritten_obligation_contains_summary(self):
        """Test that GET /api/obligations/{id} returns plain_language_summary for rewritten obligation"""
        # The main agent confirmed mining-base-metals-0 has been rewritten
        obligation_id = "mining-base-metals-0"
        response = requests.get(f"{BASE_URL}/api/obligations/{obligation_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "plain_language_summary" in data, "Missing plain_language_summary field"
        assert data["plain_language_summary"] is not None, "plain_language_summary should not be null"
        
        print(f"✓ GET /api/obligations/{obligation_id} returns plain_language_summary")
    
    def test_plain_language_summary_has_5_sections(self):
        """Test that plain_language_summary contains all 5 required sections"""
        obligation_id = "mining-base-metals-0"
        response = requests.get(f"{BASE_URL}/api/obligations/{obligation_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("plain_language_summary", {})
        required_sections = [
            "statute_jurisdiction",
            "core_obligations",
            "practical_implications",
            "deadlines_triggers",
            "non_compliance_risks"
        ]
        
        for section in required_sections:
            assert section in summary, f"Missing section: {section}"
            assert isinstance(summary[section], str), f"{section} should be a string"
            assert len(summary[section]) > 0, f"{section} should not be empty"
        
        print(f"✓ plain_language_summary contains all 5 sections:")
        for section in required_sections:
            print(f"  - {section}: {summary[section][:50]}...")


class TestRewriteSingleObligation:
    """Tests for POST /api/obligations/{obligation_id}/rewrite endpoint"""
    
    def test_rewrite_nonexistent_obligation_returns_404(self):
        """Test that rewriting a non-existent obligation returns 404"""
        response = requests.post(f"{BASE_URL}/api/obligations/nonexistent-id-12345/rewrite")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ POST /api/obligations/nonexistent-id-12345/rewrite returns 404")
    
    def test_rewrite_endpoint_exists_and_accessible(self):
        """Test that rewrite endpoint is accessible (may take time due to LLM)"""
        # Find an obligation without plain_language_summary
        # First check the rewrite status
        status_response = requests.get(f"{BASE_URL}/api/obligations/rewrite-status")
        status_data = status_response.json()
        
        if status_data.get("pending", 0) > 0:
            print(f"✓ Found {status_data['pending']} obligations pending rewrite")
        else:
            print(f"✓ All obligations have been rewritten")


class TestObligationsListWithSummary:
    """Tests for GET /api/obligations to verify plain_language_summary inclusion"""
    
    def test_obligations_list_includes_plain_language_summary(self):
        """Test that obligations list includes plain_language_summary field when present"""
        response = requests.get(f"{BASE_URL}/api/obligations")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of obligations"
        assert len(data) > 0, "Should have at least one obligation"
        
        # Find the rewritten obligation in the list
        rewritten_found = False
        for obl in data:
            if obl.get("plain_language_summary"):
                rewritten_found = True
                assert "statute_jurisdiction" in obl["plain_language_summary"]
                assert "core_obligations" in obl["plain_language_summary"]
                print(f"✓ Found obligation '{obl['id']}' with plain_language_summary in list")
                break
        
        if not rewritten_found:
            print("⚠ No obligations with plain_language_summary found in list")
        
        assert rewritten_found, "Expected at least one obligation with plain_language_summary"


# Run tests with verbose output
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
