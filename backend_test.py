#!/usr/bin/env python3
"""
Backend API Testing for Cove Legal Tech SaaS Platform
Tests all API endpoints to ensure proper functionality before frontend testing.
"""

import requests
import sys
import json
from datetime import datetime

class CoveAPITester:
    def __init__(self, base_url="https://lusaka-legal-tech.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.test_company_id = None
        self.test_user_id = None
        self.test_obligation_id = None

    def log_test(self, name, passed, details="", error=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"
        
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
            
        self.test_results.append({
            "test": name,
            "passed": passed,
            "details": details,
            "error": error
        })

    def test_health_endpoints(self):
        """Test basic health and info endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Root endpoint", True, f"Status: {response.status_code}, Message: {data.get('message', '')}")
            else:
                self.log_test("Root endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Root endpoint", False, error=str(e))

        # Test health endpoint
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Health endpoint", True, f"Status: {data.get('status', '')}")
            else:
                self.log_test("Health endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Health endpoint", False, error=str(e))

    def test_sectors_endpoint(self):
        """Test sectors/legislation data endpoints"""
        print("\n🔍 Testing Sectors Endpoints...")
        
        try:
            response = requests.get(f"{self.base_url}/sectors", timeout=10)
            if response.status_code == 200:
                data = response.json()
                sectors = data.get('sectors', {})
                total_sectors = len(sectors)
                self.log_test("Get sectors", True, f"Found {total_sectors} sectors: {list(sectors.keys())}")
                
                # Test specific legislation endpoint
                if 'mining' in sectors and 'Base Metals' in sectors['mining']:
                    leg_response = requests.get(f"{self.base_url}/legislation/mining/Base Metals", timeout=10)
                    if leg_response.status_code == 200:
                        leg_data = leg_response.json()
                        obligations = leg_data.get('obligations', [])
                        self.log_test("Get legislation data", True, f"Found {len(obligations)} obligations for mining/Base Metals")
                    else:
                        self.log_test("Get legislation data", False, f"Status: {leg_response.status_code}")
                else:
                    self.log_test("Get legislation data", False, "Mining sector or Base Metals not found")
            else:
                self.log_test("Get sectors", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get sectors", False, error=str(e))

    def test_company_endpoints(self):
        """Test company CRUD operations"""
        print("\n🔍 Testing Company Endpoints...")
        
        # Create test company
        test_company_data = {
            "name": "Test Mining Corp",
            "registration_number": "TEST123456",
            "email": "test@testmining.zm",
            "phone": "+260123456789",
            "address": "Test Address, Lusaka",
            "size": "medium",
            "sector": "mining",
            "sub_sector": "Base Metals"
        }
        
        try:
            response = requests.post(f"{self.base_url}/companies", json=test_company_data, timeout=15)
            if response.status_code == 200:
                company = response.json()
                self.test_company_id = company.get('id')
                self.log_test("Create company", True, f"Created company ID: {self.test_company_id}, Score: {company.get('compliance_score', 0)}")
            else:
                self.log_test("Create company", False, f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_test("Create company", False, error=str(e))
            return

        # Get all companies
        try:
            response = requests.get(f"{self.base_url}/companies", timeout=10)
            if response.status_code == 200:
                companies = response.json()
                self.log_test("Get all companies", True, f"Found {len(companies)} companies")
            else:
                self.log_test("Get all companies", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get all companies", False, error=str(e))

        # Get specific company
        if self.test_company_id:
            try:
                response = requests.get(f"{self.base_url}/companies/{self.test_company_id}", timeout=10)
                if response.status_code == 200:
                    company = response.json()
                    self.log_test("Get specific company", True, f"Retrieved company: {company.get('name')}")
                else:
                    self.log_test("Get specific company", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Get specific company", False, error=str(e))

    def test_obligations_endpoints(self):
        """Test obligations endpoints"""
        print("\n🔍 Testing Obligations Endpoints...")
        
        # Get all obligations
        try:
            response = requests.get(f"{self.base_url}/obligations", timeout=10)
            if response.status_code == 200:
                obligations = response.json()
                self.log_test("Get all obligations", True, f"Found {len(obligations)} obligations")
                
                if obligations:
                    self.test_obligation_id = obligations[0].get('id')
                    
                    # Test obligation filters
                    if self.test_company_id:
                        filter_response = requests.get(f"{self.base_url}/obligations?company_id={self.test_company_id}", timeout=10)
                        if filter_response.status_code == 200:
                            filtered_obligations = filter_response.json()
                            self.log_test("Get obligations by company", True, f"Found {len(filtered_obligations)} obligations for company")
                        else:
                            self.log_test("Get obligations by company", False, f"Status: {filter_response.status_code}")
                    
                    # Test category filter
                    category_response = requests.get(f"{self.base_url}/obligations?category=Corporate", timeout=10)
                    if category_response.status_code == 200:
                        cat_obligations = category_response.json()
                        self.log_test("Get obligations by category", True, f"Found {len(cat_obligations)} Corporate obligations")
                    else:
                        self.log_test("Get obligations by category", False, f"Status: {category_response.status_code}")
                        
            else:
                self.log_test("Get all obligations", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get all obligations", False, error=str(e))

        # Get specific obligation
        if self.test_obligation_id:
            try:
                response = requests.get(f"{self.base_url}/obligations/{self.test_obligation_id}", timeout=10)
                if response.status_code == 200:
                    obligation = response.json()
                    self.log_test("Get specific obligation", True, f"Retrieved obligation: {obligation.get('obligation', '')[:50]}...")
                else:
                    self.log_test("Get specific obligation", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Get specific obligation", False, error=str(e))

        # Update obligation status
        if self.test_obligation_id:
            try:
                response = requests.patch(f"{self.base_url}/obligations/{self.test_obligation_id}/status", 
                                        params={"status": "completed"}, timeout=10)
                if response.status_code == 200:
                    result = response.json()
                    self.log_test("Update obligation status", True, f"Updated to: {result.get('status')}")
                else:
                    self.log_test("Update obligation status", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Update obligation status", False, error=str(e))

    def test_dashboard_endpoint(self):
        """Test dashboard stats endpoint"""
        print("\n🔍 Testing Dashboard Endpoint...")
        
        if not self.test_company_id:
            self.log_test("Dashboard stats", False, "No test company ID available")
            return

        try:
            response = requests.get(f"{self.base_url}/dashboard/stats/{self.test_company_id}", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                details = f"Score: {stats.get('compliance_score')}%, Total: {stats.get('total_obligations')}, Critical: {stats.get('critical_items')}"
                self.log_test("Dashboard stats", True, details)
            else:
                self.log_test("Dashboard stats", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Dashboard stats", False, error=str(e))

    def test_ai_summary_endpoint(self):
        """Test AI summary generation"""
        print("\n🔍 Testing AI Summary Endpoint...")
        
        # Test AI summary with sample data
        test_ai_request = {
            "statute": "Mines and Minerals Development Act No. 11 of 2015",
            "obligation": "Annual Mining License Renewal",
            "action_required": "Submit renewal application with updated environmental reports"
        }
        
        try:
            response = requests.post(f"{self.base_url}/ai/summary", json=test_ai_request, timeout=30)
            if response.status_code == 200:
                summary = response.json()
                details = f"Generated by: {summary.get('approved_by', '')}, Key points: {len(summary.get('key_points', []))}"
                self.log_test("AI Summary generation", True, details)
                print(f"   Sample summary: {summary.get('summary', '')[:100]}...")
            else:
                self.log_test("AI Summary generation", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("AI Summary generation", False, error=str(e))

    def test_user_endpoints(self):
        """Test user management endpoints"""
        print("\n🔍 Testing User Endpoints...")
        
        # Create test user
        test_user_data = {
            "email": "test.user@testcorp.zm",
            "name": "Test User",
            "role": "corporate-user",
            "company_id": self.test_company_id
        }
        
        try:
            response = requests.post(f"{self.base_url}/users", json=test_user_data, timeout=10)
            if response.status_code == 200:
                user = response.json()
                self.test_user_id = user.get('id')
                self.log_test("Create user", True, f"Created user ID: {self.test_user_id}, Role: {user.get('role')}")
            else:
                self.log_test("Create user", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create user", False, error=str(e))

        # Get all users
        try:
            response = requests.get(f"{self.base_url}/users", timeout=10)
            if response.status_code == 200:
                users = response.json()
                self.log_test("Get all users", True, f"Found {len(users)} users")
            else:
                self.log_test("Get all users", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get all users", False, error=str(e))

        # Delete test user
        if self.test_user_id:
            try:
                response = requests.delete(f"{self.base_url}/users/{self.test_user_id}", timeout=10)
                if response.status_code == 200:
                    result = response.json()
                    self.log_test("Delete user", True, result.get('message', 'User deleted'))
                else:
                    self.log_test("Delete user", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Delete user", False, error=str(e))

    def test_admin_analytics_endpoint(self):
        """Test admin analytics endpoint"""
        print("\n🔍 Testing Admin Analytics Endpoint...")
        
        try:
            response = requests.get(f"{self.base_url}/admin/analytics", timeout=10)
            if response.status_code == 200:
                analytics = response.json()
                details = f"Companies: {analytics.get('total_companies')}, Users: {analytics.get('total_users')}, Obligations: {analytics.get('total_obligations')}"
                self.log_test("Admin analytics", True, details)
            else:
                self.log_test("Admin analytics", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Admin analytics", False, error=str(e))

    def test_notifications_endpoint(self):
        """Test notifications endpoint"""
        print("\n🔍 Testing Notifications Endpoint...")
        
        if not self.test_company_id or not self.test_obligation_id:
            self.log_test("Notifications", False, "Missing company or obligation ID")
            return

        # Create notification
        notification_data = {
            "company_id": self.test_company_id,
            "obligation_id": self.test_obligation_id,
            "email": "test@company.zm",
            "days_before": 7
        }
        
        try:
            response = requests.post(f"{self.base_url}/notifications", json=notification_data, timeout=10)
            if response.status_code == 200:
                notification = response.json()
                self.log_test("Create notification", True, f"Created notification for {notification.get('email')}")
            else:
                self.log_test("Create notification", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Create notification", False, error=str(e))

        # Get notifications
        try:
            response = requests.get(f"{self.base_url}/notifications?company_id={self.test_company_id}", timeout=10)
            if response.status_code == 200:
                notifications = response.json()
                self.log_test("Get notifications", True, f"Found {len(notifications)} notifications")
            else:
                self.log_test("Get notifications", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get notifications", False, error=str(e))

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Cove Legal Tech Backend API Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test all endpoints in logical order
        self.test_health_endpoints()
        self.test_sectors_endpoint()
        self.test_company_endpoints()
        self.test_obligations_endpoints()
        self.test_dashboard_endpoint()
        self.test_ai_summary_endpoint()
        self.test_user_endpoints()
        self.test_admin_analytics_endpoint()
        self.test_notifications_endpoint()
        
        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        # Calculate success percentage
        success_percentage = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_percentage:.1f}%")
        
        if success_percentage >= 80:
            print("✅ Backend API Status: HEALTHY")
            return 0
        elif success_percentage >= 60:
            print("⚠️  Backend API Status: PARTIAL - Some issues need attention")
            return 1
        else:
            print("❌ Backend API Status: CRITICAL - Major issues found")
            return 2

def main():
    """Main test execution"""
    tester = CoveAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())