#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Cove Legal Tech Platform
Tests all Super Admin enhancement endpoints and core functionality
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class CoveAPITester:
    def __init__(self, base_url: str = "https://cove-wallet-pull.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Cove-API-Tester/1.0'
        })
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, endpoint: str, method: str, status_code: int, expected: int, passed: bool, response_data: Any = None, error: str = None):
        """Log individual test results"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            
        result = {
            "endpoint": endpoint,
            "method": method,
            "expected_status": expected,
            "actual_status": status_code,
            "passed": passed,
            "timestamp": datetime.now().isoformat(),
            "error": error,
            "has_data": response_data is not None and len(str(response_data)) > 0
        }
        self.test_results.append(result)
        
        status_icon = "✅" if passed else "❌"
        print(f"{status_icon} [{method}] {endpoint} - Expected: {expected}, Got: {status_code}")
        if error:
            print(f"   Error: {error}")
        
    def test_endpoint(self, method: str, endpoint: str, expected_status: int = 200, data: Dict = None, params: Dict = None) -> tuple:
        """Test a single endpoint"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, params=params)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, params=params)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, json=data, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            passed = response.status_code == expected_status
            response_data = None
            
            try:
                if response.content:
                    response_data = response.json()
            except json.JSONDecodeError:
                response_data = {"raw_content": response.text[:500]}
                
            self.log_test(endpoint, method, response.status_code, expected_status, passed, response_data)
            return passed, response_data
            
        except Exception as e:
            error_msg = str(e)
            self.log_test(endpoint, method, 0, expected_status, False, None, error_msg)
            return False, {"error": error_msg}

    def test_core_endpoints(self):
        """Test basic API endpoints"""
        print("\n🔍 Testing Core API Endpoints...")
        
        # Health check
        self.test_endpoint("GET", "health")
        
        # Root endpoint
        self.test_endpoint("GET", "")
        
        # Sectors
        self.test_endpoint("GET", "sectors")
        
    def test_admin_analytics(self):
        """Test admin analytics endpoints"""
        print("\n📊 Testing Admin Analytics...")
        
        self.test_endpoint("GET", "admin/analytics")
        self.test_endpoint("GET", "admin/revenue")
        
    def test_user_management(self):
        """Test user management endpoints"""
        print("\n👥 Testing User Management...")
        
        # Get users
        self.test_endpoint("GET", "users")
        
        # Test user creation
        test_user = {
            "name": "Test Admin User",
            "email": "test.admin@cove.zm",
            "role": "super-admin",
            "department": "Testing",
            "phone": "+260 97 000 0000"
        }
        success, user_data = self.test_endpoint("POST", "users", 200, test_user)
        
        if success and user_data.get("id"):
            user_id = user_data["id"]
            
            # Test get specific user
            self.test_endpoint("GET", f"users/{user_id}")
            
            # Test user update
            update_data = {"name": "Updated Test User", "status": "active"}
            self.test_endpoint("PUT", f"users/{user_id}", 200, update_data)
            
            # Test bulk user actions
            bulk_data = {"action": "activate", "user_ids": [user_id]}
            self.test_endpoint("POST", "users/bulk-action", 200, bulk_data)
            
            # Clean up - delete test user
            self.test_endpoint("DELETE", f"users/{user_id}")
        
        # Test user filters
        self.test_endpoint("GET", "users", params={"role": "super-admin"})
        self.test_endpoint("GET", "users", params={"status": "active"})
        
    def test_company_management(self):
        """Test company management endpoints"""
        print("\n🏢 Testing Company Management...")
        
        # Get companies
        self.test_endpoint("GET", "companies")
        
        # Test company creation
        test_company = {
            "name": "Test Mining Corp",
            "registration_number": "TEST001",
            "size": "large",
            "sector": "mining",
            "sub_sector": "Base Metals",
            "email": "admin@testmining.zm",
            "phone": "+260 97 111 1111",
            "address": "Test Address, Lusaka"
        }
        success, company_data = self.test_endpoint("POST", "companies", 200, test_company)
        
        if success and company_data.get("id"):
            company_id = company_data["id"]
            
            # Test get specific company
            self.test_endpoint("GET", f"companies/{company_id}")
            
            # Test company update
            update_data = {"subscription_plan": "Enterprise"}
            self.test_endpoint("PUT", f"companies/{company_id}", 200, update_data)
            
            # Clean up
            self.test_endpoint("DELETE", f"companies/{company_id}")
    
    def test_roles_and_permissions(self):
        """Test roles and permissions"""
        print("\n🔐 Testing Roles & Permissions...")
        
        self.test_endpoint("GET", "roles")
        
        # Test role creation
        role_data = {
            "name": "test-role",
            "display_name": "Test Role",
            "description": "Role for testing purposes",
            "permissions": ["test.view", "test.edit"]
        }
        self.test_endpoint("POST", "roles", 200, role_data)
        
    def test_audit_logs(self):
        """Test audit logging"""
        print("\n📋 Testing Audit Logs...")
        
        self.test_endpoint("GET", "audit-logs")
        self.test_endpoint("GET", "audit-logs", params={"limit": 50, "offset": 0})
        self.test_endpoint("GET", "audit-logs", params={"action": "user.create"})
        
    def test_support_tickets(self):
        """Test support ticket system"""
        print("\n🎫 Testing Support Tickets...")
        
        # Get tickets
        self.test_endpoint("GET", "tickets")
        
        # Create test ticket
        ticket_data = {
            "user_id": "test-user-123",
            "user_name": "Test User",
            "company_id": "test-company-123",
            "company_name": "Test Company",
            "subject": "Test Support Ticket",
            "description": "This is a test support ticket created during API testing",
            "priority": "medium"
        }
        success, ticket_response = self.test_endpoint("POST", "tickets", 200, ticket_data)
        
        if success and ticket_response.get("id"):
            ticket_id = ticket_response["id"]
            
            # Test get specific ticket
            self.test_endpoint("GET", f"tickets/{ticket_id}")
            
            # Test ticket update
            self.test_endpoint("PATCH", f"tickets/{ticket_id}", 200, {"status": "in_progress"})
            
            # Test add ticket message
            message_data = {
                "sender_id": "admin-123",
                "sender_name": "Admin User",
                "message": "This is a test message for the ticket",
                "is_internal": False
            }
            self.test_endpoint("POST", f"tickets/{ticket_id}/messages", 200, message_data)
        
        # Test ticket filters
        self.test_endpoint("GET", "tickets", params={"status": "open"})
        self.test_endpoint("GET", "tickets", params={"priority": "high"})
        
    def test_subscription_plans(self):
        """Test subscription plans"""
        print("\n💳 Testing Subscription Plans...")
        
        self.test_endpoint("GET", "subscription-plans")
        
        # Test plan creation
        plan_data = {
            "name": "Test Plan",
            "price": 1500.0,
            "features": ["Feature 1", "Feature 2", "Feature 3"],
            "user_limit": 25,
            "storage_limit_gb": 25
        }
        self.test_endpoint("POST", "subscription-plans", 200, plan_data)
        
    def test_invoices(self):
        """Test invoice management"""
        print("\n💰 Testing Invoices...")
        
        self.test_endpoint("GET", "invoices")
        self.test_endpoint("GET", "invoices", params={"status": "pending"})
        
        # Note: Invoice creation is typically automatic, so we just test status update
        # We'll need an existing invoice ID for this test
        
    def test_legislation_management(self):
        """Test legislation database"""
        print("\n⚖️ Testing Legislation Management...")
        
        self.test_endpoint("GET", "legislation")
        self.test_endpoint("GET", "legislation", params={"sector": "mining"})
        
        # Test legislation creation
        legislation_data = {
            "statute_name": "Test Mining Act",
            "act_number": "TEST-001",
            "sector": "mining",
            "sub_sector": "Base Metals",
            "category": "Core Operations",
            "description": "Test legislation for mining operations",
            "effective_date": "2026-01-01"
        }
        success, leg_response = self.test_endpoint("POST", "legislation", 200, legislation_data)
        
        if success and leg_response.get("id"):
            leg_id = leg_response["id"]
            
            # Test legislation update
            update_data = {
                "statute_name": "Updated Test Mining Act",
                "description": "Updated test legislation"
            }
            self.test_endpoint("PUT", f"legislation/{leg_id}", 200, update_data)
            
            # Clean up
            self.test_endpoint("DELETE", f"legislation/{leg_id}")
        
    def test_global_search(self):
        """Test global search functionality"""
        print("\n🔍 Testing Global Search...")
        
        # Test search with various queries
        self.test_endpoint("GET", "search", params={"q": "test"})
        self.test_endpoint("GET", "search", params={"q": "admin"})
        self.test_endpoint("GET", "search", params={"q": "mining"})
        self.test_endpoint("GET", "search", params={"q": "co"})  # Short query
        
    def test_notifications(self):
        """Test activity notifications"""
        print("\n🔔 Testing Activity Notifications...")
        
        self.test_endpoint("GET", "activity-notifications")
        self.test_endpoint("GET", "activity-notifications", params={"limit": 5, "unread_only": "true"})
        
        # Test mark as read
        mark_read_data = {"notification_ids": []}  # Empty to mark all as read
        self.test_endpoint("POST", "activity-notifications/mark-read", 200, mark_read_data)
        
    def test_system_settings(self):
        """Test system settings"""
        print("\n⚙️ Testing System Settings...")
        
        self.test_endpoint("GET", "settings/system")
        
        # Test settings update
        settings_data = {
            "id": "system-settings",
            "platform_name": "Cove Legal Tech - Test Mode",
            "support_email": "support@cove.zm",
            "default_language": "en",
            "timezone": "Africa/Lusaka",
            "date_format": "DD/MM/YYYY",
            "currency": "ZMW",
            "session_timeout_minutes": 60,
            "password_min_length": 8,
            "mfa_required_roles": [],
            "backup_frequency": "daily"
        }
        self.test_endpoint("PUT", "settings/system", 200, settings_data)
        
    def test_ai_integration(self):
        """Test AI summary functionality"""
        print("\n🤖 Testing AI Integration...")
        
        ai_request = {
            "statute": "Mines and Minerals Development Act No. 11 of 2015",
            "obligation": "Annual Mining License Renewal",
            "action_required": "Submit renewal application with updated environmental reports"
        }
        self.test_endpoint("POST", "ai/summary", 200, ai_request)
        
    def test_obligations_and_documents(self):
        """Test obligations and document management"""
        print("\n📋 Testing Obligations & Documents...")
        
        # Test obligations
        self.test_endpoint("GET", "obligations")
        self.test_endpoint("GET", "obligations", params={"category": "Core Operations"})
        self.test_endpoint("GET", "obligations", params={"severity": "critical"})
        
        # Test documents
        self.test_endpoint("GET", "documents")
        self.test_endpoint("GET", "documents", params={"file_type": "pdf"})
        
    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print("🚀 Starting Cove Legal Tech API Test Suite")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        test_methods = [
            self.test_core_endpoints,
            self.test_admin_analytics,
            self.test_user_management,
            self.test_company_management,
            self.test_roles_and_permissions,
            self.test_audit_logs,
            self.test_support_tickets,
            self.test_subscription_plans,
            self.test_invoices,
            self.test_legislation_management,
            self.test_global_search,
            self.test_notifications,
            self.test_system_settings,
            self.test_ai_integration,
            self.test_obligations_and_documents
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ Test method {test_method.__name__} failed with error: {str(e)}")
                continue
                
        self.print_summary()
        return self.tests_passed / self.tests_run if self.tests_run > 0 else 0
        
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📝 Total Tests: {self.tests_run}")
        print(f"📊 Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0.0%")
        
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t["passed"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests[:10]:  # Show first 10 failed tests
                print(f"   • [{test['method']}] {test['endpoint']} - Expected: {test['expected_status']}, Got: {test['actual_status']}")
                if test['error']:
                    print(f"     Error: {test['error']}")
        
        # Key endpoints status
        key_endpoints = [
            "admin/analytics",
            "users", 
            "companies",
            "roles",
            "audit-logs",
            "tickets",
            "subscription-plans",
            "search"
        ]
        
        print(f"\n🔑 KEY ENDPOINTS STATUS:")
        for endpoint in key_endpoints:
            endpoint_tests = [t for t in self.test_results if endpoint in t["endpoint"]]
            if endpoint_tests:
                passed = sum(1 for t in endpoint_tests if t["passed"])
                total = len(endpoint_tests)
                status = "✅" if passed == total else "⚠️" if passed > 0 else "❌"
                print(f"   {status} {endpoint}: {passed}/{total}")
            else:
                print(f"   ❓ {endpoint}: Not tested")

if __name__ == "__main__":
    print("🔧 Cove Legal Tech - Backend API Test Suite")
    print("Testing Super Admin Enhancement APIs")
    
    tester = CoveAPITester()
    success_rate = tester.run_all_tests()
    
    # Exit with appropriate code
    exit_code = 0 if success_rate >= 0.8 else 1  # 80% success threshold
    sys.exit(exit_code)