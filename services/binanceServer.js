const axios = require('axios');
const math = require('mathjs');

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches candlestick data from Binance API
 * @param {string} symbol - Trading pair (e.g., 'BTCUSDT', 'ETHUSDT')
 * @param {string} interval - Candlestick interval (e.g., '15m', '1h', '1d')
 * @param {number} limit - Number of candles to fetch (max 1000)
 * @returns {Promise<Array>} - Array of candlestick data
 */
async function fetchBinanceKlines(symbol, interval = '15m', limit = 1000) {
  try {
    // Calculate start time (if needed)
    // For MA99 with 15m candles, we need at least 99 candles
    // Adding some buffer to ensure we have enough data
    const now = Date.now();
    const startTime = now - (limit * getIntervalInMs(interval) * 1.5); // 1.5x buffer

    // const url = 'https://api.binance.com/api/v3/klines';
    const url = 'https://binance43.p.rapidapi.com/klines';
    const response = await axios.get(url, {
      headers: {
        'x-rapidapi-key': '9709d4ad7cmshd462b4191d35fc1p14ccc3jsnbf08b0387396',
        'x-rapidapi-host': 'binance43.p.rapidapi.com'
      },
      params: {
        symbol: symbol.toUpperCase(),
        interval: interval,
        startTime: startTime,
        limit: limit
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching Binance klines for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Convert interval string to milliseconds
 * @param {string} interval - Interval string (e.g., '15m', '1h', '1d')
 * @returns {number} - Milliseconds
 */
function getIntervalInMs(interval) {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000; // Default to minutes
  }
}

/**
 * Calculate Moving Average for an array of values
 * @param {Array<number>} data - Array of numeric values
 * @param {number} period - MA period
 * @returns {Array<number>} - Array of MA values
 */
function calculateMA(data, period) {
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // Not enough data for full window
      result.push(null);
    } else {
      // Get window of data
      const window = data.slice(i - period + 1, i + 1);
      // Calculate average
      const sum = window.reduce((acc, val) => acc + val, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array<number>} prices - Array of prices
 * @param {number} period - RSI period (typically 14)
 * @returns {number} - RSI value
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    return null;
  }
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate RSI for each remaining price
  for (let i = period + 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    
    if (difference >= 0) {
      avgGain = ((avgGain * (period - 1)) + difference) / period;
      avgLoss = ((avgLoss * (period - 1)) + 0) / period;
    } else {
      avgGain = ((avgGain * (period - 1)) + 0) / period;
      avgLoss = ((avgLoss * (period - 1)) + Math.abs(difference)) / period;
    }
  }
  
  if (avgLoss === 0) {
    return 100;
  }
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate Bollinger Bands
 * @param {Array<number>} prices - Array of prices
 * @param {number} period - Period for MA (typically 20)
 * @param {number} stdDev - Number of standard deviations (typically 2)
 * @returns {Object} - Upper and lower bands
 */
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  // Calculate simple moving average
  const sma = calculateMA(prices, period).slice(-1)[0];
  
  // Calculate standard deviation
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, value) => {
    return sum + Math.pow(value - sma, 2);
  }, 0) / period;
  
  const sd = Math.sqrt(variance);
  
  return {
    upper: sma + (stdDev * sd),
    middle: sma,
    lower: sma - (stdDev * sd)
  };
}

/**
 * Calculate entry and exit points based on technical indicators
 * @param {string} symbol - Trading symbol
 * @param {number} currentPrice - Current price
 * @param {number} lowerBB - Lower Bollinger Band
 * @param {number} upperBB - Upper Bollinger Band
 * @returns {Object} - Entry and exit points
 */
function calculateEntryExitPoints(symbol, currentPrice, lowerBB, upperBB) {
  const entryPoint = lowerBB || currentPrice * 0.95;
  const exitPoint = upperBB || currentPrice * 1.05;
  return { entryPoint, exitPoint };
}
/**
 * Format raw kline data into enhanced candlestick format with technical analysis
 * @param {Array} klines - Raw kline data from Binance
 * @param {Array<number>} ma7Values - 7-period moving average values
 * @param {Array<number>} ma25Values - 25-period moving average values
 * @param {Array<number>} ma50Values - 50-period moving average values
 * @param {Array<number>} ma99Values - 99-period moving average values
 * @param {Array<number|null>} ma200Values - 200-period moving average values (may be null)
 * @returns {Array<Object>} - Formatted candlestick data with analysis
 */
function formatCandlestickData(klines, ma7Values, ma25Values, ma50Values, ma99Values, ma200Values) {
  // Find signals in the data based on local minima and maxima
  const findSignals = (data, windowSize = 5) => {
    return data.map((item, index, array) => {
      if (index < windowSize || index > array.length - windowSize - 1) return null;

      const window = array.slice(index - windowSize, index + windowSize + 1);
      const currentPrice = parseFloat(item[4]); // Close price

      // Check if current point is a local maximum (sell signal)
      const isLocalMax = window.every(p => parseFloat(p[4]) <= currentPrice);
      
      // Check if current point is a local minimum (buy signal)
      const isLocalMin = window.every(p => parseFloat(p[4]) >= currentPrice);

      if (isLocalMax) return 'sell';
      if (isLocalMin) return 'buy';
      return null;
    });
  };
  
  // Calculate signals
  const signals = findSignals(klines);
  
  return klines.map((candle, index) => {
    const [time, open, high, low, close, volume] = candle;
    
    // Parse values
    const timeValue = parseInt(time);
    const openValue = parseFloat(open);
    const highValue = parseFloat(high);
    const lowValue = parseFloat(low);
    const closeValue = parseFloat(close);
    const volumeValue = parseFloat(volume);
    
    // Calculate price change and percentage
    const priceChange = closeValue - openValue;
    const priceChangePercent = (priceChange / openValue) * 100;
    
    // Calculate body and shadow lengths
    const bodyLength = Math.abs(closeValue - openValue);
    const upperShadow = highValue - Math.max(openValue, closeValue);
    const lowerShadow = Math.min(openValue, closeValue) - lowValue;
    
    // Determine candle patterns
    const isHammer = lowerShadow > (2 * bodyLength) && upperShadow <= (0.1 * bodyLength);
    const isInvertedHammer = upperShadow > (2 * bodyLength) && lowerShadow <= (0.1 * bodyLength);
    const isDoji = bodyLength <= (0.1 * (highValue - lowValue));
    
    // Volume analysis
    let volumeChange = 0;
    let averageVolume = 0;
    if (index > 0) {
      volumeChange = ((volumeValue - parseFloat(klines[index - 1][5])) / parseFloat(klines[index - 1][5])) * 100;
      const volumeSum = klines.slice(Math.max(0, index - 5), index)
        .reduce((sum, curr) => sum + parseFloat(curr[5]), 0);
      averageVolume = volumeSum / Math.min(5, index);
    }
    
    // Volatility (based on high-low range)
    const dayRange = ((highValue - lowValue) / lowValue) * 100;
    
    // Get MA values for this candle
    const ma7 = ma7Values[index];
    const ma25 = ma25Values[index];
    const ma50 = ma50Values[index];
    const ma99 = ma99Values[index];
    const ma200 = ma200Values ? ma200Values[index] : null;
    
    const candlestickdata =  {
      time: timeValue,
      timeFormatted: new Date(timeValue).toISOString(),
      open: openValue,
      high: highValue,
      low: lowValue,
      close: closeValue,
      volume: volumeValue,
      candleColor: closeValue > openValue ? '#22c55e' : '#ef4444',
      analysis: {
        priceChange: Number(priceChange.toFixed(8)),
        priceChangePercent: Number(priceChangePercent.toFixed(2)),
        bodyLength: Number(bodyLength.toFixed(8)),
        upperShadow: Number(upperShadow.toFixed(8)),
        lowerShadow: Number(lowerShadow.toFixed(8)),
        patterns: {
          isHammer,
          isInvertedHammer,
          isDoji
        },
        volume: {
          change: Number(volumeChange.toFixed(2)),
          averageVolume: Math.round(averageVolume),
          aboveAverage: volumeValue > averageVolume
        },
        volatility: Number(dayRange.toFixed(2))
      },
      technicals: {
        ma7: ma7 !== null ? Number(ma7.toFixed(8)) : null,
        ma25: ma25 !== null ? Number(ma25.toFixed(8)) : null,
        ma50: ma50 !== null ? Number(ma50.toFixed(8)) : null,
        ma99: ma99 !== null ? Number(ma99.toFixed(8)) : null,
        ma200: ma200 !== null ? Number(ma200.toFixed(8)) : null,
        signal: signals[index]
      }
    }
    // console.log('candlestickdata',candlestickdata);
    return candlestickdata;
  });
}
/**
 * Fetch stock data using Binance API with multiple timeframe analysis
 * @param {string} ticker - Trading symbol (e.g., "RAYUSDT")
 * @param {Object} additionalData - Any additional data to include in the response
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Stock data with technical indicators
 */
async function fetchStockData(ticker, additionalData = {}, retries = 1) {
  const symbol = ticker.includes('USDT') ? ticker : `${ticker}USDT`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Fetch both 15m data (for candlesticks) and 1d data (for long-term analysis)
      const [klines15m, klines1d] = await Promise.all([
        fetchBinanceKlines(symbol, '15m', 300), // 15m data for detailed chart
        fetchBinanceKlines(symbol, '1d', 200)   // 1d data for longer-term analysis
      ]);
      
      if (!klines15m || klines15m.length === 0 || !klines1d || klines1d.length === 0) {
        throw new Error('No kline data available');
      }
      
      // Process 1d data for technical analysis
      const closingPrices1d = klines1d.map(candle => parseFloat(candle[4]));
      const volumes1d = klines1d.map(candle => parseFloat(candle[5]));
      const timestamps1d = klines1d.map(candle => parseInt(candle[0]));
      
      // Calculate moving averages on daily data for better trend analysis
      const ma7_1d = calculateMA(closingPrices1d, 7);
      const ma25_1d = calculateMA(closingPrices1d, 25);
      const ma50_1d = calculateMA(closingPrices1d, 50);
      const ma99_1d = calculateMA(closingPrices1d, 99);
      const ma200_1d = closingPrices1d.length >= 200 ? calculateMA(closingPrices1d, 200) : Array(closingPrices1d.length).fill(null);
      
      // Calculate RSI on daily data
      const rsi_1d = calculateRSI(closingPrices1d);
      
      // Calculate Bollinger Bands on daily data
      const bollingerBands_1d = calculateBollingerBands(closingPrices1d);
      
      // Process 15m data for candlestick chart
      const closingPrices15m = klines15m.map(candle => parseFloat(candle[4]));
      const openPrices15m = klines15m.map(candle => parseFloat(candle[1]));
      const highPrices15m = klines15m.map(candle => parseFloat(candle[2]));
      const lowPrices15m = klines15m.map(candle => parseFloat(candle[3]));
      const volumes15m = klines15m.map(candle => parseFloat(candle[5]));
      const timestamps15m = klines15m.map(candle => parseInt(candle[0]));
      
      // Calculate moving averages on 15m data for intraday analysis
      const ma7_15m = calculateMA(closingPrices15m, 7);
      const ma25_15m = calculateMA(closingPrices15m, 25);
      const ma50_15m = calculateMA(closingPrices15m, 50);
      const ma99_15m = calculateMA(closingPrices15m, 99);
      const ma200_15m = closingPrices15m.length >= 200 ? calculateMA(closingPrices15m, 200) : Array(closingPrices15m.length).fill(null);
      
      // Get current price (last 15m candle's close)
      const currentPrice = closingPrices15m[closingPrices15m.length - 1];
      
      // Calculate 24h change percentage using 15m data
      const oneDayAgoIndex = findNearestTimestampIndex(timestamps15m, timestamps15m[timestamps15m.length - 1] - 24 * 60 * 60 * 1000);
      const oneDayAgoPrice = oneDayAgoIndex >= 0 ? closingPrices15m[oneDayAgoIndex] : closingPrices15m[0];
      const changePercent = ((currentPrice - oneDayAgoPrice) / oneDayAgoPrice) * 100;
      
      // Format candlestick data for charting using 15m data
      const candlestickData = formatCandlestickData(klines15m, ma7_15m, ma25_15m, ma50_15m, ma99_15m, ma200_15m);
      console.log('candlestickData',candlestickData);
      // Calculate entry/exit points based on volatility using daily data for more stability
      const recentDailyPrices = klines1d.slice(-20).map(candle => ({
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3])
      }));
      
      const highestPrice = Math.max(...recentDailyPrices.map(d => d.high));
      const lowestPrice = Math.min(...recentDailyPrices.map(d => d.low));
      const priceRange = highestPrice - lowestPrice;
      
      // Calculate daily volatility - day high-low range percentage
      const calculateDailyVolatility = (dailyCandles) => {
        return dailyCandles.map(candle => {
          const high = parseFloat(candle[2]);
          const low = parseFloat(candle[3]);
          return ((high - low) / low) * 100;
        });
      };
      
      const dailyVolatility = calculateDailyVolatility(klines1d.slice(-20));
      const avgVolatility = dailyVolatility.reduce((sum, val) => sum + val, 0) / dailyVolatility.length;
      
      // Adjust entry/exit points based on volatility
      const volatilityFactor = avgVolatility / 100;
      const entryPoint = currentPrice - (priceRange * Math.min(0.1, volatilityFactor));
      const exitPoint = currentPrice + (priceRange * Math.max(0.2, volatilityFactor * 2));
      const stopLoss = entryPoint - (priceRange * Math.min(0.05, volatilityFactor / 2));
      
      // Calculate volume in the last 24 hours using 15m data
      const volume24h = calculateVolume24h(timestamps15m, volumes15m);
      
      // Get latest technical signals using daily data for more reliability
      const technicalSignals = analyzeTechnicalSignals(
        closingPrices1d,
        ma7_1d.slice(-1)[0],
        ma25_1d.slice(-1)[0],
        ma50_1d.slice(-1)[0],
        rsi_1d,
        bollingerBands_1d
      );
      
      // Determine market trend based on daily MAs
      const marketTrend = currentPrice > ma50_1d.slice(-1)[0] ? 'bullish' : 
                         currentPrice < ma50_1d.slice(-1)[0] ? 'bearish' : 'neutral';
      
      // Construct result object
      return {
        additionalData: additionalData,
        ticker: symbol,
        name: additionalData.name || symbol,
        price: currentPrice.toFixed(8),
        volume: volume24h.toFixed(2),
        market_cap: additionalData.market_cap || 'N/A',
        change_percent: changePercent.toFixed(2),
        // Use daily values for these indicators
        rsi: rsi_1d ? rsi_1d.toFixed(2) : 'N/A',
        ma_7: ma7_1d.length > 0 ? ma7_1d[ma7_1d.length - 1].toFixed(8) : 'N/A',
        ma_25: ma25_1d.length > 0 ? ma25_1d[ma25_1d.length - 1].toFixed(8) : 'N/A',
        ma_50: ma50_1d.length > 0 ? ma50_1d[ma50_1d.length - 1].toFixed(8) : 'N/A',
        ma_99: ma99_1d.length > 0 ? ma99_1d[ma99_1d.length - 1].toFixed(8) : 'N/A',
        ma_200: ma200_1d.length > 0 && ma200_1d[ma200_1d.length - 1] !== null ? ma200_1d[ma200_1d.length - 1].toFixed(8) : 'N/A',
        bollinger_upper: bollingerBands_1d.upper.toFixed(8),
        bollinger_lower: bollingerBands_1d.lower.toFixed(8),
        // Use 15m data for the candlestick chart
        candles: candlestickData,
        signals: {
          ...technicalSignals,
          entryPoint: Number(entryPoint.toFixed(8)),
          exitPoint: Number(exitPoint.toFixed(8)),
          stopLoss: Number(stopLoss.toFixed(8)),
          marketTrend,
          volatility: Number(avgVolatility.toFixed(2))
        },
        // Include daily data metrics for reference
        daily_metrics: {
          last_price: parseFloat(klines1d[klines1d.length - 1][4]),
          avg_volume: volumes1d.slice(-7).reduce((sum, vol) => sum + vol, 0) / 7,
          volatility: avgVolatility,
          ma7: ma7_1d[ma7_1d.length - 1],
          ma25: ma25_1d[ma25_1d.length - 1],
          ma50: ma50_1d[ma50_1d.length - 1],
          rsi: rsi_1d
        },
        metadata: {
          currency: 'USDT',
          exchange: 'Binance',
          marketCap: additionalData.market_cap || 'N/A',
          lastUpdated: new Date().toISOString()
        },
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${symbol}:`, error.message);
      
      if (attempt === retries) {
        console.error(`Failed to fetch data for ${symbol} after ${retries} attempts:`, error.message);
        return {
          additionalData: additionalData,
          ticker: symbol,
          error: error.message,
          name: additionalData.name || 'N/A',
          price: 'N/A',
          volume: 'N/A',
          market_cap: 'N/A',
          change_percent: 'N/A',
          rsi: 'N/A',
          ma_7: 'N/A',
          ma_25: 'N/A',
          ma_50: 'N/A',
          ma_99: 'N/A',
          ma_200: 'N/A',
          bollinger_upper: 'N/A',
          bollinger_lower: 'N/A',
          entry_point: 'N/A',
          exit_point: 'N/A',
          candles: []
        };
      }
      
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

/**
 * Find index of nearest timestamp in an array
 * @param {Array<number>} timestamps - Array of timestamps
 * @param {number} targetTimestamp - Target timestamp to find
 * @returns {number} - Index of nearest timestamp
 */
function findNearestTimestampIndex(timestamps, targetTimestamp) {
  let closestIndex = -1;
  let minDiff = Number.MAX_SAFE_INTEGER;
  
  for (let i = 0; i < timestamps.length; i++) {
    const diff = Math.abs(timestamps[i] - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

/**
 * Calculate total volume in the last 24 hours
 * @param {Array<number>} timestamps - Array of candle timestamps
 * @param {Array<number>} volumes - Array of candle volumes
 * @returns {number} - Total volume in last 24 hours
 */
function calculateVolume24h(timestamps, volumes) {
  const now = timestamps[timestamps.length - 1];
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  let volume24h = 0;
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (timestamps[i] >= oneDayAgo) {
      volume24h += volumes[i];
    } else {
      break;
    }
  }
  
  return volume24h;
}

// /**
//  * Format raw kline data into candlestick format
//  * @param {Array} klines - Raw kline data from Binance
//  * @returns {Array<Object>} - Formatted candlestick data
//  */
// function formatCandlestickData(klines) {
//   return klines.map(candle => {
//     const [time, open, high, low, close, volume] = candle;
    
//     return {
//       time: parseInt(time),
//       timeFormatted: new Date(parseInt(time)).toISOString(),
//       open: parseFloat(open),
//       high: parseFloat(high),
//       low: parseFloat(low),
//       close: parseFloat(close),
//       volume: parseFloat(volume),
//       candleColor: parseFloat(close) > parseFloat(open) ? '#22c55e' : '#ef4444'
//     };
//   });
// }

/**
 * Analyze technical signals based on indicators
 * @param {Array<number>} prices - Array of closing prices
 * @param {number} ma7 - 7-period moving average
 * @param {number} ma25 - 25-period moving average
 * @param {number} ma50 - 50-period moving average
 * @param {number} rsi - RSI value
 * @param {Object} bollingerBands - Bollinger Bands object
 * @returns {Object} - Technical signals analysis
 */
function analyzeTechnicalSignals(prices, ma7, ma25, ma50, rsi, bollingerBands) {
  const currentPrice = prices[prices.length - 1];
  
  // Trend signals based on MA crossovers
  const shortTermTrend = currentPrice > ma7 ? 'bullish' : 'bearish';
  const mediumTermTrend = currentPrice > ma25 ? 'bullish' : 'bearish';
  const longTermTrend = currentPrice > ma50 ? 'bullish' : 'bearish';
  
  // RSI signals
  let rsiSignal = 'neutral';
  if (rsi <= 30) rsiSignal = 'oversold';
  else if (rsi >= 70) rsiSignal = 'overbought';
  
  // Bollinger Band signals
  let bbSignal = 'neutral';
  if (currentPrice >= bollingerBands.upper) bbSignal = 'overbought';
  else if (currentPrice <= bollingerBands.lower) bbSignal = 'oversold';
  
  // Price momentum
  const priceChange5 = ((currentPrice / prices[prices.length - 6]) - 1) * 100;
  
  // Volume analysis
  // (This would be more accurate with actual volume data)
  
  // Combined signal
  let overallSignal = 'hold';
  
  // Bullish conditions
  if (
    (shortTermTrend === 'bullish' && mediumTermTrend === 'bullish') ||
    (rsiSignal === 'oversold' && bbSignal === 'oversold')
  ) {
    overallSignal = 'buy';
  }
  
  // Bearish conditions
  if (
    (shortTermTrend === 'bearish' && mediumTermTrend === 'bearish') ||
    (rsiSignal === 'overbought' && bbSignal === 'overbought')
  ) {
    overallSignal = 'sell';
  }
  
  // Calculate potential entry/exit points based on volatility
  const recentPrices = prices.slice(-20);
  const highestPrice = Math.max(...recentPrices);
  const lowestPrice = Math.min(...recentPrices);
  const priceRange = highestPrice - lowestPrice;
  
  // Volatility-based entry/exit calculations
  const volatilityFactor = (priceRange / lowestPrice);
  const stopLoss = currentPrice * (1 - (volatilityFactor * 0.5));
  
  return {
    trend: {
      shortTerm: shortTermTrend,
      mediumTerm: mediumTermTrend,
      longTerm: longTermTrend,
      overall: [shortTermTrend, mediumTermTrend, longTermTrend].filter(t => t === 'bullish').length >= 2 ? 'bullish' : 'bearish'
    },
    rsi: {
      value: rsi ? rsi.toFixed(2) : 'N/A',
      signal: rsiSignal
    },
    bollingerBands: {
      upper: bollingerBands.upper.toFixed(8),
      middle: bollingerBands.middle.toFixed(8),
      lower: bollingerBands.lower.toFixed(8),
      signal: bbSignal
    },
    momentum: {
      priceChange5: priceChange5.toFixed(2) + '%'
    },
    recommendation: overallSignal,
    riskManagement: {
      stopLoss: stopLoss.toFixed(8),
      riskRewardRatio: (Math.abs((bollingerBands.upper - currentPrice) / (currentPrice - stopLoss))).toFixed(2)
    }
  };
}

// Export functions
module.exports = {
  fetchBinanceKlines,
  fetchStockData,
  calculateMA,
  calculateRSI,
  calculateBollingerBands
};