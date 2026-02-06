"""
Dashboard API Tests for Cove Zambia Legal Tech Platform
Tests the dashboard stats endpoint with trend_data and severity_breakdown
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardAPI:
    """Dashboard statistics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get first company ID for testing"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
        
        response = requests.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200, "Failed to get companies list"
        companies = response.json()
        assert len(companies) > 0, "No companies found in database"
        self.company_id = companies[0]['id']
        self.company_name = companies[0]['name']
        print(f"\nTesting with company: {self.company_name} ({self.company_id})")
    
    def test_dashboard_stats_endpoint_success(self):
        """Test dashboard stats returns 200 with valid company ID"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Dashboard stats endpoint returns 200")
    
    def test_dashboard_stats_company_data(self):
        """Test dashboard stats returns company information"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "company" in data, "Response missing 'company' field"
        company = data["company"]
        
        assert "name" in company, "Company missing 'name'"
        assert "sector" in company, "Company missing 'sector'"
        assert "sub_sector" in company, "Company missing 'sub_sector'"
        
        print(f"✅ Company data returned: {company['name']} - {company['sector']}/{company['sub_sector']}")
    
    def test_dashboard_stats_compliance_score(self):
        """Test dashboard returns compliance score with trend"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "compliance_score" in data, "Response missing 'compliance_score'"
        assert isinstance(data["compliance_score"], int), "compliance_score should be integer"
        assert 0 <= data["compliance_score"] <= 100, "compliance_score should be 0-100"
        
        assert "previous_score" in data, "Response missing 'previous_score'"
        assert isinstance(data["previous_score"], int), "previous_score should be integer"
        
        print(f"✅ Compliance score: {data['compliance_score']}% (previous: {data['previous_score']}%)")
    
    def test_dashboard_stats_quick_stats(self):
        """Test dashboard returns quick stats - Total, Critical, Priority, Completed"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        # Total obligations
        assert "total_obligations" in data, "Response missing 'total_obligations'"
        assert isinstance(data["total_obligations"], int), "total_obligations should be integer"
        
        # Critical items
        assert "critical_items" in data, "Response missing 'critical_items'"
        assert isinstance(data["critical_items"], int), "critical_items should be integer"
        
        # High priority items
        assert "high_priority_items" in data, "Response missing 'high_priority_items'"
        assert isinstance(data["high_priority_items"], int), "high_priority_items should be integer"
        
        # Completed obligations
        assert "completed_obligations" in data, "Response missing 'completed_obligations'"
        assert isinstance(data["completed_obligations"], int), "completed_obligations should be integer"
        
        print(f"✅ Quick stats - Total: {data['total_obligations']}, Critical: {data['critical_items']}, High Priority: {data['high_priority_items']}, Completed: {data['completed_obligations']}")
    
    def test_dashboard_stats_trend_data(self):
        """Test dashboard returns trend_data for 6-month area chart"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "trend_data" in data, "Response missing 'trend_data'"
        trend_data = data["trend_data"]
        
        assert isinstance(trend_data, list), "trend_data should be a list"
        assert len(trend_data) == 6, f"trend_data should have 6 months, got {len(trend_data)}"
        
        # Check each trend data point
        for point in trend_data:
            assert "month" in point, "Trend point missing 'month'"
            assert "score" in point, "Trend point missing 'score'"
            assert "completed" in point, "Trend point missing 'completed'"
            assert isinstance(point["score"], int), "score should be integer"
            assert isinstance(point["completed"], int), "completed should be integer"
        
        months = [p["month"] for p in trend_data]
        print(f"✅ Trend data returned for months: {months}")
    
    def test_dashboard_stats_severity_breakdown(self):
        """Test dashboard returns severity_breakdown for donut/pie chart"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "severity_breakdown" in data, "Response missing 'severity_breakdown'"
        severity_breakdown = data["severity_breakdown"]
        
        assert isinstance(severity_breakdown, list), "severity_breakdown should be a list"
        assert len(severity_breakdown) == 4, f"severity_breakdown should have 4 items (Critical, High, Medium, Low), got {len(severity_breakdown)}"
        
        expected_names = ["Critical", "High", "Medium", "Low"]
        for item in severity_breakdown:
            assert "name" in item, "Severity item missing 'name'"
            assert "value" in item, "Severity item missing 'value'"
            assert "fill" in item, "Severity item missing 'fill' (color)"
            assert item["name"] in expected_names, f"Unexpected severity name: {item['name']}"
            assert isinstance(item["value"], int), "value should be integer"
            assert item["fill"].startswith("#"), "fill should be hex color"
        
        breakdown = {item["name"]: item["value"] for item in severity_breakdown}
        print(f"✅ Severity breakdown: Critical={breakdown.get('Critical')}, High={breakdown.get('High')}, Medium={breakdown.get('Medium')}, Low={breakdown.get('Low')}")
    
    def test_dashboard_stats_categories(self):
        """Test dashboard returns categories with progress data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "categories" in data, "Response missing 'categories'"
        categories = data["categories"]
        
        assert isinstance(categories, dict), "categories should be a dictionary"
        
        for cat_name, cat_data in categories.items():
            assert "total" in cat_data, f"Category {cat_name} missing 'total'"
            assert "completed" in cat_data, f"Category {cat_name} missing 'completed'"
            assert "critical" in cat_data, f"Category {cat_name} missing 'critical'"
            assert "high" in cat_data, f"Category {cat_name} missing 'high'"
            assert "medium" in cat_data, f"Category {cat_name} missing 'medium'"
            assert "low" in cat_data, f"Category {cat_name} missing 'low'"
        
        print(f"✅ Categories returned: {list(categories.keys())}")
    
    def test_dashboard_stats_upcoming_deadlines(self):
        """Test dashboard returns upcoming deadlines"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "upcoming_deadlines" in data, "Response missing 'upcoming_deadlines'"
        deadlines = data["upcoming_deadlines"]
        
        assert isinstance(deadlines, list), "upcoming_deadlines should be a list"
        
        if len(deadlines) > 0:
            for deadline in deadlines:
                assert "obligation" in deadline, "Deadline missing 'obligation'"
                assert "due_date" in deadline, "Deadline missing 'due_date'"
                assert "severity" in deadline, "Deadline missing 'severity'"
            print(f"✅ Upcoming deadlines: {len(deadlines)} items")
        else:
            print("✅ No upcoming deadlines (expected if all obligations complete)")
    
    def test_dashboard_stats_invalid_company(self):
        """Test dashboard stats returns 404 for invalid company ID"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/invalid-company-id-123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Returns 404 for invalid company ID")
    
    def test_dashboard_stats_overdue_items(self):
        """Test dashboard returns overdue_items count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "overdue_items" in data, "Response missing 'overdue_items'"
        assert isinstance(data["overdue_items"], int), "overdue_items should be integer"
        print(f"✅ Overdue items: {data['overdue_items']}")
    
    def test_dashboard_stats_pending_items(self):
        """Test dashboard returns pending_items count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats/{self.company_id}")
        data = response.json()
        
        assert "pending_items" in data, "Response missing 'pending_items'"
        assert isinstance(data["pending_items"], int), "pending_items should be integer"
        print(f"✅ Pending items: {data['pending_items']}")


class TestHealthAndCompanies:
    """Health and companies endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ Health endpoint returns healthy")
    
    def test_companies_endpoint(self):
        """Test companies endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        companies = response.json()
        assert isinstance(companies, list)
        assert len(companies) > 0, "Expected at least one company"
        print(f"✅ Companies endpoint returns {len(companies)} companies")
    
    def test_sectors_endpoint(self):
        """Test sectors endpoint returns sector configuration"""
        response = requests.get(f"{BASE_URL}/api/sectors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✅ Sectors endpoint returns {len(data)} sectors")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
