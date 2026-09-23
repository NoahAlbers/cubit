export interface paypalTransactions {
  transaction_details: TransactionDetailsEntity[];
  account_number: string;
  start_date: string;
  end_date: string;
  last_refreshed_datetime: string;
  page: number;
  total_items: number;
  total_pages: number;
  links?: LinksEntity[] | null;
}
export interface TransactionDetailsEntity {
  transaction_info: TransactionInfo;
  payer_info: PayerInfo;
  shipping_info: ShippingInfo;
  cart_info: CartInfo;
  store_info: StoreInfoOrAuctionInfoOrIncentiveInfoOrCartInfo;
  auction_info: StoreInfoOrAuctionInfoOrIncentiveInfoOrCartInfo;
  incentive_info: StoreInfoOrAuctionInfoOrIncentiveInfoOrCartInfo;
}
export interface TransactionInfo {
  paypal_account_id: string;
  transaction_id: string;
  paypal_reference_id?: string | null;
  paypal_reference_id_type?: string | null;
  transaction_event_code: string;
  transaction_initiation_date: string;
  transaction_updated_date: string;
  transaction_amount: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
  fee_amount?: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount1 | null;
  transaction_status: string;
  transaction_subject?: string | null;
  ending_balance: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
  available_balance: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
  protection_eligibility: string;
  transaction_note?: string | null;
}
export interface TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount {
  currency_code: string;
  value: string;
}
export interface TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount1 {
  currency_code: string;
  value: string;
}
export interface PayerInfo {
  account_id: string;
  email_address: string;
  address_status: string;
  payer_status: string;
  payer_name: PayerName;
  country_code: string;
}
export interface PayerName {
  given_name?: string | null;
  surname?: string | null;
  alternate_full_name: string;
}
export interface ShippingInfo {
  name: string;
}
export interface CartInfo {
  item_details?: ItemDetailsEntity[] | null;
}
export interface ItemDetailsEntity {
  item_quantity: string;
  item_unit_price: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
  item_amount: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
  total_item_amount: TransactionAmountOrFeeAmountOrEndingBalanceOrAvailableBalanceOrItemUnitPriceOrItemAmountOrTotalItemAmount;
}
export interface StoreInfoOrAuctionInfoOrIncentiveInfoOrCartInfo {}
export interface LinksEntity {
  href: string;
  rel: string;
  method: string;
}
