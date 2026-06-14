import prisma from '../db/prisma.js';

export class CurrencyService {
  /**
   * Fetches exchange rate to convert from `fromCurrency` to `INR` effective on or before `date`.
   */
  static async getExchangeRate(fromCurrency, date = new Date()) {
    const currencyUpper = fromCurrency.toUpperCase();
    if (currencyUpper === 'INR') {
      return 1.0;
    }

    // Find the latest rate effective before or on the given date
    const rateRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: currencyUpper,
        toCurrency: 'INR',
        effectiveDate: {
          lte: date,
        },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    if (rateRecord) {
      return Number(rateRecord.rate);
    }

    // Fallback: look for ANY rate of this currency
    const fallbackRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: currencyUpper,
        toCurrency: 'INR',
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    if (fallbackRecord) {
      return Number(fallbackRecord.rate);
    }

    return null; // Indicates currency not supported / missing rate
  }

  static async convertToInr(amount, fromCurrency, date = new Date()) {
    const rate = await this.getExchangeRate(fromCurrency, date);
    if (rate === null) {
      throw new Error(`Exchange rate for ${fromCurrency} to INR on ${date.toISOString().split('T')[0]} not found.`);
    }
    return {
      convertedAmount: Number(amount) * rate,
      exchangeRate: rate
    };
  }
}
