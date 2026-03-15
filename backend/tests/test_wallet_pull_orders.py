"""
Wallet Pull Orders API Tests
Tests for the Pull Order (direct debit) feature on the wallet module
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
COMPANY_ID = "test-company-001"


class TestWalletHealthAndSetup:
    """Health check and basic wallet setup tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"Health check passed: {response.json()}")
    
    def test_wallet_sub_account_exists(self):
        """Verify sub-account exists for test company"""
        response = requests.get(f"{BASE_URL}/api/wallet/sub-accounts/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["company_id"] == COMPANY_ID
        assert "available_balance" in data
        print(f"Sub-account found: {data['id']}")


class TestWalletBankAccounts:
    """Bank account management tests"""
    
    def test_get_linked_bank_accounts(self):
        """Get linked bank accounts for company"""
        response = requests.get(f"{BASE_URL}/api/wallet/bank-accounts/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} linked bank accounts")
        
        if len(data) > 0:
            account = data[0]
            assert "id" in account
            assert "bank_code" in account
            assert "account_number_masked" in account
            assert "status" in account
    
    def test_link_new_bank_account(self):
        """Test linking a new bank account"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/bank-accounts/{COMPANY_ID}/link",
            json={
                "bank_code": "STAN",
                "account_number": "9876543210",
                "account_name": "Test Corp Account 2",
                "set_as_primary": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["bank_code"] == "STAN"
        assert data["account_name"] == "Test Corp Account 2"
        assert "****3210" in data["account_number_masked"]
        print(f"Bank account linked: {data['id']}")


class TestPullOrderCreate:
    """Pull order creation tests"""
    
    def test_get_pull_orders_empty_or_existing(self):
        """Get existing pull orders"""
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "pull_orders" in data
        assert "total" in data
        print(f"Found {data['total']} pull orders")
    
    def test_create_pull_order_success(self):
        """Create a new pull order"""
        # First get bank accounts to use
        bank_response = requests.get(f"{BASE_URL}/api/wallet/bank-accounts/{COMPANY_ID}")
        bank_accounts = bank_response.json()
        
        if len(bank_accounts) == 0:
            pytest.skip("No bank accounts available")
        
        # Use first verified bank account
        verified_accounts = [ba for ba in bank_accounts if ba["status"] == "verified"]
        if len(verified_accounts) == 0:
            pytest.skip("No verified bank accounts")
        
        bank_account = verified_accounts[0]
        
        response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}/create",
            json={
                "amount": 3000.0,
                "description": "Test pull order for API testing",
                "source_bank_account_id": bank_account["id"],
                "purpose": "other",
                "purpose_reference": "TEST-API-001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "pull_order" in data
        assert data["pull_order"]["status"] == "pending_approval"
        assert data["pull_order"]["amount"] == 3000.0
        assert "approval_token" in data["pull_order"]
        print(f"Pull order created: {data['pull_order']['id']}")
        return data["pull_order"]
    
    def test_create_pull_order_invalid_bank_account(self):
        """Test creating pull order with invalid bank account"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}/create",
            json={
                "amount": 1000.0,
                "description": "Test with invalid bank",
                "source_bank_account_id": "ba_invalid_id_123",
                "purpose": "other"
            }
        )
        assert response.status_code == 404
        print("Correctly rejected invalid bank account")
    
    def test_create_pull_order_invalid_company(self):
        """Test creating pull order with invalid company"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/invalid-company-999/create",
            json={
                "amount": 1000.0,
                "description": "Test with invalid company",
                "source_bank_account_id": "ba_test",
                "purpose": "other"
            }
        )
        assert response.status_code == 404
        print("Correctly rejected invalid company")


class TestPullOrderApproval:
    """Pull order approval tests"""
    
    def test_approve_pull_order(self):
        """Test approving a pull order"""
        # Get existing pending pull orders
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        pending_orders = [po for po in data["pull_orders"] if po["status"] == "pending_approval"]
        if len(pending_orders) == 0:
            pytest.skip("No pending pull orders to approve")
        
        pull_order = pending_orders[0]
        
        # Approve the pull order
        approve_response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/approve",
            json={
                "approval_token": pull_order["approval_token"],
                "client_name": "API Test User",
                "client_email": "apitest@example.com"
            }
        )
        assert approve_response.status_code == 200
        approve_data = approve_response.json()
        assert approve_data["status"] == "approved"
        print(f"Pull order approved: {pull_order['id']}")
    
    def test_approve_with_invalid_token(self):
        """Test approving with invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/approve",
            json={
                "approval_token": "invalid_token_12345",
                "client_name": "Test User",
                "client_email": "test@example.com"
            }
        )
        assert response.status_code == 404
        print("Correctly rejected invalid approval token")


class TestPullOrderRejection:
    """Pull order rejection tests"""
    
    def test_reject_pull_order(self):
        """Test rejecting a pull order"""
        # Get existing pending pull orders
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        pending_orders = [po for po in data["pull_orders"] if po["status"] == "pending_approval"]
        if len(pending_orders) == 0:
            # Create a new one to reject
            bank_response = requests.get(f"{BASE_URL}/api/wallet/bank-accounts/{COMPANY_ID}")
            bank_accounts = bank_response.json()
            verified_accounts = [ba for ba in bank_accounts if ba["status"] == "verified"]
            
            if len(verified_accounts) == 0:
                pytest.skip("No verified bank accounts")
            
            create_response = requests.post(
                f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}/create",
                json={
                    "amount": 500.0,
                    "description": "Pull order for rejection test",
                    "source_bank_account_id": verified_accounts[0]["id"],
                    "purpose": "other"
                }
            )
            if create_response.status_code != 200:
                pytest.skip("Could not create pull order for rejection test")
            pull_order = create_response.json()["pull_order"]
        else:
            pull_order = pending_orders[0]
        
        # Reject the pull order
        reject_response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/reject",
            json={
                "approval_token": pull_order["approval_token"],
                "reason": "Test rejection via API",
                "client_name": "API Tester"
            }
        )
        assert reject_response.status_code == 200
        reject_data = reject_response.json()
        assert reject_data["status"] == "rejected"
        print(f"Pull order rejected: {pull_order['id']}")


class TestPullOrderExecution:
    """Pull order execution tests"""
    
    def test_execute_approved_pull_order(self):
        """Test executing an approved pull order"""
        # Get existing approved pull orders
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        approved_orders = [po for po in data["pull_orders"] if po["status"] == "approved"]
        if len(approved_orders) == 0:
            pytest.skip("No approved pull orders to execute")
        
        pull_order = approved_orders[0]
        
        # Execute the pull order
        execute_response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/{pull_order['id']}/execute"
        )
        assert execute_response.status_code == 200
        execute_data = execute_response.json()
        assert "net_credited" in execute_data
        assert "new_balance" in execute_data
        print(f"Pull order executed: {pull_order['id']}, credited: {execute_data['net_credited']}")
    
    def test_execute_pending_order_fails(self):
        """Test executing a pending order fails"""
        # Get existing pending pull orders
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        pending_orders = [po for po in data["pull_orders"] if po["status"] == "pending_approval"]
        if len(pending_orders) == 0:
            pytest.skip("No pending pull orders")
        
        pull_order = pending_orders[0]
        
        # Try to execute pending order
        execute_response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/{pull_order['id']}/execute"
        )
        assert execute_response.status_code == 400
        print("Correctly rejected execution of pending order")


class TestPullOrderCancellation:
    """Pull order cancellation tests"""
    
    def test_cancel_pending_order(self):
        """Test cancelling a pending pull order"""
        # Get or create a pending pull order
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        pending_orders = [po for po in data["pull_orders"] if po["status"] == "pending_approval"]
        if len(pending_orders) == 0:
            bank_response = requests.get(f"{BASE_URL}/api/wallet/bank-accounts/{COMPANY_ID}")
            bank_accounts = bank_response.json()
            verified_accounts = [ba for ba in bank_accounts if ba["status"] == "verified"]
            
            if len(verified_accounts) == 0:
                pytest.skip("No verified bank accounts")
            
            create_response = requests.post(
                f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}/create",
                json={
                    "amount": 800.0,
                    "description": "Pull order for cancellation test",
                    "source_bank_account_id": verified_accounts[0]["id"],
                    "purpose": "other"
                }
            )
            if create_response.status_code != 200:
                pytest.skip("Could not create pull order for cancellation test")
            pull_order = create_response.json()["pull_order"]
        else:
            pull_order = pending_orders[0]
        
        # Cancel the pull order
        cancel_response = requests.post(
            f"{BASE_URL}/api/wallet/pull-orders/{pull_order['id']}/cancel"
        )
        assert cancel_response.status_code == 200
        cancel_data = cancel_response.json()
        assert cancel_data["status"] == "cancelled"
        print(f"Pull order cancelled: {pull_order['id']}")


class TestPullOrderDetail:
    """Pull order detail and audit trail tests"""
    
    def test_get_pull_order_detail(self):
        """Get detailed pull order with audit trail"""
        # Get any pull order
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}")
        data = response.json()
        
        if data["total"] == 0:
            pytest.skip("No pull orders available")
        
        pull_order = data["pull_orders"][0]
        
        # Get detail
        detail_response = requests.get(
            f"{BASE_URL}/api/wallet/pull-orders/detail/{pull_order['id']}"
        )
        assert detail_response.status_code == 200
        detail_data = detail_response.json()
        assert "pull_order" in detail_data
        assert "audit_trail" in detail_data
        print(f"Pull order detail retrieved: {pull_order['id']}, audit entries: {len(detail_data['audit_trail'])}")
    
    def test_get_audit_trail(self):
        """Get audit trail for company pull orders"""
        response = requests.get(f"{BASE_URL}/api/wallet/pull-orders/{COMPANY_ID}/audit")
        assert response.status_code == 200
        data = response.json()
        assert "audit_records" in data
        assert "total" in data
        print(f"Found {data['total']} audit records")


class TestWalletBalance:
    """Wallet balance tests"""
    
    def test_get_wallet_balance(self):
        """Get current wallet balance"""
        response = requests.get(f"{BASE_URL}/api/wallet/balance/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "available_balance" in data
        assert "pending_balance" in data
        assert "reserved_balance" in data
        print(f"Wallet balance: Available={data['available_balance']}, Pending={data['pending_balance']}")


class TestWalletSubscription:
    """Wallet subscription info tests"""
    
    def test_get_subscription_info(self):
        """Get subscription info"""
        response = requests.get(f"{BASE_URL}/api/wallet/subscription/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "current_tier" in data
        assert "features" in data
        assert "limits" in data
        print(f"Subscription: {data['current_tier']}, Features: {len(data['features'])}")


class TestWalletTransactions:
    """Wallet transaction history tests"""
    
    def test_get_transactions(self):
        """Get transaction history"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions/{COMPANY_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "total" in data
        print(f"Found {data['total']} transactions")
