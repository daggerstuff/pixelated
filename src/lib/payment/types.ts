/** PayRam payment states returned by the payment status API. */
export type PayRamPaymentState =
  | 'OPEN'
  | 'CANCELLED'
  | 'FILLED'
  | 'PARTIALLY_FILLED'
  | 'OVER_FILLED'

export interface PayRamPaymentStatus {
  invoiceID: string
  customerID: string
  amountInUSD: string
  paymentState: PayRamPaymentState
  merchantName: string
  referenceID: string
  createdAt: string
}

export interface PaymentVerifyResponse {
  success: true
  referenceId: string
  paymentState: PayRamPaymentState
  isPaid: boolean
  amountInUSD: string
  invoiceID: string
  createdAt: string
}
