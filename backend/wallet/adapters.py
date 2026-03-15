"""
CoveSmartWallet - Payment Aggregator Adapters
Supports cGrate (primary), DPO Pay, and Flutterwave
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from enum import Enum
import httpx
import hashlib
import hmac
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PaymentProvider(str, Enum):
    CGRATE = "cgrate"
    DPO = "dpo"
    FLUTTERWAVE = "flutterwave"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentAdapterBase(ABC):
    """Abstract base class for payment aggregator adapters"""
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self.client = httpx.AsyncClient(timeout=30.0)
    
    @abstractmethod
    async def create_payment(self, amount: float, currency: str, reference: str, 
                            customer_email: str, callback_url: str) -> Dict[str, Any]:
        """Initiate a payment/fund request"""
        pass
    
    @abstractmethod
    async def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        """Verify payment status"""
        pass
    
    @abstractmethod
    async def initiate_payout(self, amount: float, currency: str, 
                             bank_code: str, account_number: str,
                             account_name: str, reference: str) -> Dict[str, Any]:
        """Execute a payout to bank account"""
        pass
    
    @abstractmethod
    async def get_balance(self) -> Dict[str, Any]:
        """Get wallet balance"""
        pass
    
    @abstractmethod
    async def link_bank_account(self, account_details: Dict) -> Dict[str, Any]:
        """Link a bank account for funding"""
        pass


class CGrateAdapter(PaymentAdapterBase):
    """
    cGrate Payment Adapter (Primary - Zambia)
    Contact: info@cgrate.co.zm | +260 211 840008
    Licensed by Bank of Zambia for Payment Services
    """
    
    BASE_URL = "https://api.cgrate.africa/v1"  # Placeholder - get actual from cGrate
    
    def __init__(self, config: Dict[str, str]):
        super().__init__(config)
        self.merchant_id = config.get("CGRATE_MERCHANT_ID", "")
        self.api_key = config.get("CGRATE_API_KEY", "")
        self.api_secret = config.get("CGRATE_API_SECRET", "")
    
    def _generate_signature(self, payload: str) -> str:
        """Generate HMAC signature for request authentication"""
        return hmac.new(
            self.api_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def create_payment(self, amount: float, currency: str, reference: str,
                            customer_email: str, callback_url: str) -> Dict[str, Any]:
        """
        Create payment request via cGrate
        Supports: Mobile Money (Airtel, MTN, Zamtel), Bank Transfer, USSD
        """
        payload = {
            "merchant_id": self.merchant_id,
            "amount": amount,
            "currency": currency or "ZMW",
            "reference": reference,
            "customer_email": customer_email,
            "callback_url": callback_url,
            "payment_methods": ["mobile_money", "bank_transfer", "ussd"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Signature": self._generate_signature(json.dumps(payload)),
            "Content-Type": "application/json"
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/payments/create",
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            return {"success": True, "provider": "cgrate", "data": response.json()}
        except Exception as e:
            logger.error(f"cGrate payment creation failed: {e}")
            return {"success": False, "provider": "cgrate", "error": str(e)}
    
    async def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/payments/{transaction_id}/verify",
                headers=headers
            )
            return {"success": True, "provider": "cgrate", "data": response.json()}
        except Exception as e:
            return {"success": False, "provider": "cgrate", "error": str(e)}
    
    async def initiate_payout(self, amount: float, currency: str,
                             bank_code: str, account_number: str,
                             account_name: str, reference: str) -> Dict[str, Any]:
        payload = {
            "merchant_id": self.merchant_id,
            "amount": amount,
            "currency": currency or "ZMW",
            "bank_code": bank_code,
            "account_number": account_number,
            "account_name": account_name,
            "reference": reference,
            "narration": f"Cove Payout - {reference}"
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Signature": self._generate_signature(json.dumps(payload)),
            "Content-Type": "application/json"
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/payouts/initiate",
                json=payload,
                headers=headers
            )
            return {"success": True, "provider": "cgrate", "data": response.json()}
        except Exception as e:
            return {"success": False, "provider": "cgrate", "error": str(e)}
    
    async def get_balance(self) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/merchant/balance",
                headers=headers
            )
            return {"success": True, "provider": "cgrate", "data": response.json()}
        except Exception as e:
            return {"success": False, "provider": "cgrate", "error": str(e)}
    
    async def link_bank_account(self, account_details: Dict) -> Dict[str, Any]:
        """Link bank account via cGrate's built-in verification"""
        payload = {
            "merchant_id": self.merchant_id,
            "bank_code": account_details.get("bank_code"),
            "account_number": account_details.get("account_number"),
            "account_name": account_details.get("account_name"),
            "verification_method": "micro_deposit"  # or "instant"
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/bank-accounts/link",
                json=payload,
                headers=headers
            )
            return {"success": True, "provider": "cgrate", "data": response.json()}
        except Exception as e:
            return {"success": False, "provider": "cgrate", "error": str(e)}


class DPOAdapter(PaymentAdapterBase):
    """
    DPO Pay Adapter (Fallback 1 - Pan-African)
    API Docs: https://dpogroup.com/integration/
    """
    
    BASE_URL = "https://secure.3gdirectpay.com/API/v6"
    
    def __init__(self, config: Dict[str, str]):
        super().__init__(config)
        self.company_token = config.get("DPO_COMPANY_TOKEN", "")
        self.service_type = config.get("DPO_SERVICE_TYPE", "")
    
    async def create_payment(self, amount: float, currency: str, reference: str,
                            customer_email: str, callback_url: str) -> Dict[str, Any]:
        """Create payment token via DPO"""
        # Step 1: Create token
        xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
        <API3G>
            <CompanyToken>{self.company_token}</CompanyToken>
            <Request>createToken</Request>
            <Transaction>
                <PaymentAmount>{amount}</PaymentAmount>
                <PaymentCurrency>{currency or 'ZMW'}</PaymentCurrency>
                <CompanyRef>{reference}</CompanyRef>
                <RedirectURL>{callback_url}</RedirectURL>
                <BackURL>{callback_url}</BackURL>
                <CompanyRefUnique>1</CompanyRefUnique>
                <PTL>30</PTL>
            </Transaction>
            <Services>
                <Service>
                    <ServiceType>{self.service_type}</ServiceType>
                    <ServiceDescription>Cove Wallet Funding</ServiceDescription>
                    <ServiceDate>{datetime.utcnow().strftime('%Y/%m/%d %H:%M')}</ServiceDate>
                </Service>
            </Services>
        </API3G>"""
        
        try:
            response = await self.client.post(
                self.BASE_URL,
                content=xml_payload,
                headers={"Content-Type": "application/xml"}
            )
            # Parse XML response for TransToken
            return {
                "success": True, 
                "provider": "dpo",
                "data": {
                    "raw_response": response.text,
                    "payment_url": f"https://secure.3gdirectpay.com/payv3.php?ID={{token}}"
                }
            }
        except Exception as e:
            logger.error(f"DPO payment creation failed: {e}")
            return {"success": False, "provider": "dpo", "error": str(e)}
    
    async def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
        <API3G>
            <CompanyToken>{self.company_token}</CompanyToken>
            <Request>verifyToken</Request>
            <TransactionToken>{transaction_id}</TransactionToken>
        </API3G>"""
        
        try:
            response = await self.client.post(
                self.BASE_URL,
                content=xml_payload,
                headers={"Content-Type": "application/xml"}
            )
            return {"success": True, "provider": "dpo", "data": response.text}
        except Exception as e:
            return {"success": False, "provider": "dpo", "error": str(e)}
    
    async def initiate_payout(self, amount: float, currency: str,
                             bank_code: str, account_number: str,
                             account_name: str, reference: str) -> Dict[str, Any]:
        # DPO uses separate disbursement API
        return {
            "success": False, 
            "provider": "dpo", 
            "error": "Payout requires DPO disbursement API setup"
        }
    
    async def get_balance(self) -> Dict[str, Any]:
        # Balance check via DPO merchant portal API
        return {"success": True, "provider": "dpo", "data": {"balance": 0, "note": "Check DPO portal"}}
    
    async def link_bank_account(self, account_details: Dict) -> Dict[str, Any]:
        return {"success": True, "provider": "dpo", "data": {"method": "manual_verification"}}


class FlutterwaveAdapter(PaymentAdapterBase):
    """
    Flutterwave Adapter (Fallback 2 - Global)
    API Docs: https://developer.flutterwave.com
    """
    
    BASE_URL = "https://api.flutterwave.com/v3"
    
    def __init__(self, config: Dict[str, str]):
        super().__init__(config)
        self.secret_key = config.get("FLW_SECRET_KEY", "")
        self.public_key = config.get("FLW_PUBLIC_KEY", "")
    
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }
    
    async def create_payment(self, amount: float, currency: str, reference: str,
                            customer_email: str, callback_url: str) -> Dict[str, Any]:
        payload = {
            "tx_ref": reference,
            "amount": amount,
            "currency": currency or "ZMW",
            "redirect_url": callback_url,
            "customer": {
                "email": customer_email
            },
            "customizations": {
                "title": "Cove Wallet Funding",
                "logo": "https://cove.zm/logo.png"
            }
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/payments",
                json=payload,
                headers=self._headers()
            )
            data = response.json()
            return {
                "success": data.get("status") == "success",
                "provider": "flutterwave",
                "data": data
            }
        except Exception as e:
            logger.error(f"Flutterwave payment creation failed: {e}")
            return {"success": False, "provider": "flutterwave", "error": str(e)}
    
    async def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/transactions/{transaction_id}/verify",
                headers=self._headers()
            )
            data = response.json()
            return {
                "success": data.get("status") == "success",
                "provider": "flutterwave",
                "data": data
            }
        except Exception as e:
            return {"success": False, "provider": "flutterwave", "error": str(e)}
    
    async def initiate_payout(self, amount: float, currency: str,
                             bank_code: str, account_number: str,
                             account_name: str, reference: str) -> Dict[str, Any]:
        """Flutterwave Transfer API"""
        payload = {
            "account_bank": bank_code,
            "account_number": account_number,
            "amount": amount,
            "currency": currency or "ZMW",
            "reference": reference,
            "narration": f"Cove Payout - {reference}",
            "beneficiary_name": account_name
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/transfers",
                json=payload,
                headers=self._headers()
            )
            data = response.json()
            return {
                "success": data.get("status") == "success",
                "provider": "flutterwave",
                "data": data
            }
        except Exception as e:
            return {"success": False, "provider": "flutterwave", "error": str(e)}
    
    async def get_balance(self) -> Dict[str, Any]:
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/balances/ZMW",
                headers=self._headers()
            )
            data = response.json()
            return {
                "success": data.get("status") == "success",
                "provider": "flutterwave",
                "data": data
            }
        except Exception as e:
            return {"success": False, "provider": "flutterwave", "error": str(e)}
    
    async def link_bank_account(self, account_details: Dict) -> Dict[str, Any]:
        """Resolve bank account details"""
        payload = {
            "account_number": account_details.get("account_number"),
            "account_bank": account_details.get("bank_code")
        }
        
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/accounts/resolve",
                json=payload,
                headers=self._headers()
            )
            data = response.json()
            return {
                "success": data.get("status") == "success",
                "provider": "flutterwave",
                "data": data
            }
        except Exception as e:
            return {"success": False, "provider": "flutterwave", "error": str(e)}


class PaymentAggregator:
    """
    Payment Aggregator with automatic failover
    Primary: cGrate → Fallback 1: DPO → Fallback 2: Flutterwave
    """
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self.adapters = {
            PaymentProvider.CGRATE: CGrateAdapter(config),
            PaymentProvider.DPO: DPOAdapter(config),
            PaymentProvider.FLUTTERWAVE: FlutterwaveAdapter(config)
        }
        self.priority = [
            PaymentProvider.CGRATE,
            PaymentProvider.DPO,
            PaymentProvider.FLUTTERWAVE
        ]
    
    async def _execute_with_fallback(self, method_name: str, *args, **kwargs) -> Dict[str, Any]:
        """Execute method with automatic failover to backup providers"""
        last_error = None
        
        for provider in self.priority:
            adapter = self.adapters[provider]
            method = getattr(adapter, method_name)
            
            try:
                result = await method(*args, **kwargs)
                if result.get("success"):
                    logger.info(f"Payment via {provider.value} successful")
                    return result
                else:
                    last_error = result.get("error", "Unknown error")
                    logger.warning(f"{provider.value} failed: {last_error}, trying next...")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"{provider.value} exception: {e}, trying next...")
        
        return {
            "success": False,
            "error": f"All payment providers failed. Last error: {last_error}",
            "providers_tried": [p.value for p in self.priority]
        }
    
    async def create_payment(self, amount: float, currency: str, reference: str,
                            customer_email: str, callback_url: str) -> Dict[str, Any]:
        return await self._execute_with_fallback(
            "create_payment", amount, currency, reference, customer_email, callback_url
        )
    
    async def verify_payment(self, transaction_id: str, provider: Optional[str] = None) -> Dict[str, Any]:
        if provider and provider in [p.value for p in PaymentProvider]:
            adapter = self.adapters[PaymentProvider(provider)]
            return await adapter.verify_payment(transaction_id)
        return await self._execute_with_fallback("verify_payment", transaction_id)
    
    async def initiate_payout(self, amount: float, currency: str,
                             bank_code: str, account_number: str,
                             account_name: str, reference: str) -> Dict[str, Any]:
        return await self._execute_with_fallback(
            "initiate_payout", amount, currency, bank_code, account_number, account_name, reference
        )
    
    async def get_balance(self) -> Dict[str, Any]:
        return await self._execute_with_fallback("get_balance")
    
    async def link_bank_account(self, account_details: Dict) -> Dict[str, Any]:
        return await self._execute_with_fallback("link_bank_account", account_details)
