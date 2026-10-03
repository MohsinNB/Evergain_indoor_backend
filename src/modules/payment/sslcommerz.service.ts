import axios from "axios";
import config from "../../config";

export interface SSLCommerzInitParams {
  tranId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
  productName: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface SSLCommerzInitResponse {
  status: string;
  GatewayPageURL?: string;
  failedreason?: string;
  sessionkey?: string;
}

export interface SSLCommerzValidationResponse {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string | number;
  currency?: string;
  card_type?: string;
  bank_tran_id?: string;
  validated_on?: string;
  error?: string;
}

/**
 * Get SSLCommerz Base URL depending on environment config
 */
const getBaseUrl = (): string => {
  return config.sslcommerz.isLive
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";
};

/**
 * Initialize SSLCommerz Payment Session
 */
export const initSSLCommerzPayment = async (
  params: SSLCommerzInitParams,
): Promise<SSLCommerzInitResponse> => {
  const { storeId, storePass } = config.sslcommerz;

  // Mock / Sandbox Fallback for local dev when storeId is default placeholder
  if (!storeId || storeId === "your_store_id") {
    console.warn(
      "[SSLCommerz] Store ID is unconfigured/placeholder. Returning simulated mock checkout session.",
    );
    const mockUrl = `${config.frontendUrl}/mock-checkout?tran_id=${params.tranId}&amount=${params.amount}`;
    return {
      status: "SUCCESS",
      GatewayPageURL: mockUrl,
      sessionkey: `MOCK_SESSION_${Date.now()}`,
    };
  }

  const baseUrl = getBaseUrl();
  const initUrl = `${baseUrl}/gwprocess/v4/api.php`;

  const payload = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePass,
    total_amount: params.amount.toString(),
    currency: "BDT",
    tran_id: params.tranId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    ipn_url: params.ipnUrl,
    cus_name: params.customerName,
    cus_phone: params.customerPhone,
    cus_email: params.customerEmail || `${params.customerPhone}@guest.evergainavenue.com`,
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: params.productName,
    product_category: "Sports",
    product_profile: "general",
  });

  try {
    const response = await axios.post(initUrl, payload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    });

    const data = response.data as SSLCommerzInitResponse;
    return data;
  } catch (error: any) {
    console.error("[SSLCommerz Init Error]:", error?.response?.data || error.message);
    throw new Error(`SSLCommerz Init Failed: ${error?.message || "Network Error"}`);
  }
};

/**
 * Validate SSLCommerz Payment via Server-to-Server Validation API
 */
export const validateSSLCommerzPayment = async (
  valId: string,
): Promise<SSLCommerzValidationResponse> => {
  const { storeId, storePass } = config.sslcommerz;

  if (!storeId || storeId === "your_store_id" || valId.startsWith("MOCK_VAL_")) {
    console.warn(
      "[SSLCommerz] Validating with Mock mode due to placeholder store ID or mock valId.",
    );
    return {
      status: "VALID",
      val_id: valId,
      card_type: "BKASH-MOCK",
      validated_on: new Date().toISOString(),
    };
  }

  const baseUrl = getBaseUrl();
  const validationUrl = `${baseUrl}/validator/api/validationserverAPI.php`;

  try {
    const response = await axios.get(validationUrl, {
      params: {
        val_id: valId,
        store_id: storeId,
        store_passwd: storePass,
        format: "json",
      },
      timeout: 10000,
    });

    return response.data as SSLCommerzValidationResponse;
  } catch (error: any) {
    console.error("[SSLCommerz Validation Error]:", error?.response?.data || error.message);
    throw new Error(
      `SSLCommerz Validation Call Failed: ${error?.message || "Network Error"}`,
    );
  }
};
