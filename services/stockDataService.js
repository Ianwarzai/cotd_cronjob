
const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');
const fs = require('fs');
const csv = require('csv-parser');
const yahooFinance = require('yahoo-finance2').default;
const math = require('mathjs');
let priceCache = {};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch S&P 500 tickers from Wikipedia
    async function fetchSP500Tickers() {
    const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

    try {
        // Fetch the HTML content of the page
        const response = await axios.get(url);
        
        // Load the HTML into Cheerio
        const $ = cheerio.load(response.data);
        
        // Find the table containing the tickers
        const tickers = [];

        // Loop through the rows of the table and extract the ticker symbols
        $('table.wikitable tbody tr').each((index, element) => {
            const ticker = $(element).find('td:nth-child(1) a').text().trim();
            if (ticker) {
                tickers.push(ticker);
            }
        });

        
        return tickers;

    } catch (error) {
        console.error('Error fetching S&P 500 tickers:', error.message);
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
    const url = 'https://api.jup.ag/tokens/v1/tagged/verified';

    try {
        const response = await axios.get(url);
        
        // Filter OUT any tokens with USD, BTC, or ETH in their name or symbol
        const filteredTokens = response.data.filter(token => {
            const symbol = token.symbol.toUpperCase();
            const name = token.name.toUpperCase();
            
            // Exclude if it contains USD, BTC, or ETH in symbol or name
            return !symbol.includes('USD') && 
            !name.includes('USD') && 
            !symbol.includes('BTC') && 
            !name.includes('BTC') && 
            !symbol.includes('ETH') && 
            !name.includes('ETH') && 
            !symbol.includes('BNB') && 
            !name.includes('BNB');
     
        });
        
        // Map to return required fields with proper format
        return filteredTokens
            .slice(0, limit)
            .map(token => {
                // If coingeckoId exists in extensions, use it as id, otherwise use address
                const id = token.extensions?.coingeckoId || token.address;
                
                return {
                    id: id,
                    name: token.name,
                    symbol: `${token.symbol.toUpperCase()}USDT`,
                    // Include all other information from the Jupiter API
                    address: token.address,
                    decimals: token.decimals,
                    logoURI: token.logoURI,
                    tags: token.tags,
                    daily_volume: token.daily_volume,
                    created_at: token.created_at,
                    freeze_authority: token.freeze_authority,
                    mint_authority: token.mint_authority,
                    permanent_delegate: token.permanent_delegate,
                    minted_at: token.minted_at,
                    extensions: token.extensions
                };
            });
    } catch (error) {
        console.error('Jupiter API Error:', error.message);
        return [];
    }
}
// Fetch penny stock tickers from a CSV file (using dummy data here)

function fetchPennyStockTickers() {
  return new Promise((resolve, reject) => {
      const tickers = [];

      // Read the CSV file and parse it
      fs.createReadStream('./stocks/penny_stocks.csv')
          .pipe(csv())
          .on('data', (row) => {
              // Assuming the ticker is in the first column of the CSV file (index 0)
              tickers.push(row[Object.keys(row)[0]]);
          })
          .on('end', () => {
              resolve(tickers); // Return the list of tickers as a promise
          })
          .on('error', (error) => {
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
        const squaredDiffs = slice.map(x => Math.pow(x - mean, 2));
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
    return 100 - (100 / (1 + relativeStrength));
};
async function candleStickRecords(symbol) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 100);

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        };

        const [historyResult, quoteResult] = await Promise.all([
            yahooFinance.historical(symbol, queryOptions),
            yahooFinance.quote(symbol)
        ]);

        // Function to identify local peaks and troughs
        const findSignals = (data, windowSize = 5) => {
            return data.map((item, index, array) => {
                if (index < windowSize || index > array.length - windowSize - 1) return null;

                const window = array.slice(index - windowSize, index + windowSize + 1);
                const currentPrice = item.close;

                // Check if current point is a local maximum (sell signal)
                const isLocalMax = window.every(p => p.close <= currentPrice);
                
                // Check if current point is a local minimum (buy signal)
                const isLocalMin = window.every(p => p.close >= currentPrice);

                if (isLocalMax) return 'sell';
                if (isLocalMin) return 'buy';
                return null;
            });
        };

        const candlestickData = historyResult.map((item, index, array) => {
            const baseData = {
                time: item.date.toISOString().split('T')[0],
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
                candleColor: item.close > item.open ? '#22c55e' : '#ef4444'
            };

            const priceChange = item.close - item.open;
            const priceChangePercent = (priceChange / item.open) * 100;
            const bodyLength = Math.abs(item.close - item.open);
            const upperShadow = item.high - Math.max(item.open, item.close);
            const lowerShadow = Math.min(item.open, item.close) - item.low;

            const isHammer = lowerShadow > (2 * bodyLength) && upperShadow <= (0.1 * bodyLength);
            const isInvertedHammer = upperShadow > (2 * bodyLength) && lowerShadow <= (0.1 * bodyLength);
            const isDoji = bodyLength <= (0.1 * (item.high - item.low));

            let volumeChange = 0;
            let averageVolume = 0;
            if (index > 0) {
                volumeChange = ((item.volume - array[index - 1].volume) / array[index - 1].volume) * 100;
                const volumeSum = array.slice(Math.max(0, index - 5), index).reduce((sum, curr) => sum + curr.volume, 0);
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
                        isDoji
                    },
                    volume: {
                        change: Number(volumeChange.toFixed(2)),
                        averageVolume: Math.round(averageVolume),
                        aboveAverage: item.volume > averageVolume
                    },
                    volatility: Number(dayRange.toFixed(2))
                }
            };
        });

        // Calculate buy/sell signals
        const signals = findSignals(candlestickData);

        // Calculate moving averages
        const calculateMA = (data, period) => {
            return data.map((_, index) => {
                if (index < period - 1) return null;
                const slice = data.slice(index - (period - 1), index + 1);
                const average = slice.reduce((sum, item) => sum + item.close, 0) / period;
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
                signal: signals[index]
            }
        }));

        const currentPrice = quoteResult.regularMarketPrice;
        const lastMA20 = ma20[ma20.length - 1];
        const lastMA50 = ma50[ma50.length - 1];
        const marketTrend = currentPrice > lastMA50 ? 'bullish' : 
                           currentPrice < lastMA50 ? 'bearish' : 'neutral';

        const recentPrices = candlestickData.slice(-20);
        const highestPrice = Math.max(...recentPrices.map(d => d.high));
        const lowestPrice = Math.min(...recentPrices.map(d => d.low));
        const priceRange = highestPrice - lowestPrice;
        const volatility = recentPrices.reduce((sum, d) => sum + d.analysis.volatility, 0) / 20;

        const volatilityFactor = volatility / 100;
        const entryPoint = currentPrice - (priceRange * Math.min(0.1, volatilityFactor));
        const exitPoint = currentPrice + (priceRange * Math.max(0.2, volatilityFactor * 2));
        const stopLoss = entryPoint - (priceRange * Math.min(0.05, volatilityFactor / 2));

        // Get the latest signal
        const latestSignal = signals.filter(s => s !== null).pop() || 'hold';

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
                currentSignal: latestSignal
            },
            metadata: {
                currency: quoteResult.currency,
                exchange: quoteResult.exchange,
                marketCap: quoteResult.marketCap,
                lastUpdated: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
        throw new Error(`Failed to fetch stock data for ${symbol}: ${error.message}`);
    }
}
async function candleStickRecordsForDayTrading(ticker) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const findSignals = (data, windowSize = 5) => {
        return data.map((item, index, array) => {
            if (index < windowSize || index > array.length - windowSize - 1) return null;

            const window = array.slice(index - windowSize, index + windowSize + 1);
            const currentPrice = item.close;

            // Check if current point is a local maximum (sell signal)
            const isLocalMax = window.every(p => p.close <= currentPrice);
            
            // Check if current point is a local minimum (buy signal)
            const isLocalMin = window.every(p => p.close >= currentPrice);

            if (isLocalMax) return 'sell';
            if (isLocalMin) return 'buy';
            return null;
        });
    };
    const queryOptions = {
      period1: twentyFourHoursAgo,
      period2: now,
      interval: '15m',
      return: 'array'
    };
  
    try {
    //   const result = await yahooFinance.chart(ticker, queryOptions);
      const [historyResult, quoteResult] = await Promise.all([
        yahooFinance.chart(ticker, queryOptions),
        yahooFinance.quote(ticker)
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
            candleColor: item.close > item.open ? '#22c55e' : '#ef4444'
        };

        // Calculate price change and percentage
        const priceChange = item.close - item.open;
        const priceChangePercent = (priceChange / item.open) * 100;

        // Calculate body and shadow lengths
        const bodyLength = Math.abs(item.close - item.open);
        const upperShadow = item.high - Math.max(item.open, item.close);
        const lowerShadow = Math.min(item.open, item.close) - item.low;

        // Determine candle patterns
        const isHammer = lowerShadow > (2 * bodyLength) && upperShadow <= (0.1 * bodyLength);
        const isInvertedHammer = upperShadow > (2 * bodyLength) && lowerShadow <= (0.1 * bodyLength);
        const isDoji = bodyLength <= (0.1 * (item.high - item.low));

        // Volume analysis
        let volumeChange = 0;
        let averageVolume = 0;
        if (index > 0) {
            volumeChange = ((item.volume - array[index - 1].volume) / array[index - 1].volume) * 100;
            const volumeSum = array.slice(Math.max(0, index - 5), index).reduce((sum, curr) => sum + curr.volume, 0);
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
                    isDoji
                },
                volume: {
                    change: Number(volumeChange.toFixed(2)),
                    averageVolume: Math.round(averageVolume),
                    aboveAverage: item.volume > averageVolume
                },
                volatility: Number(dayRange.toFixed(2))
            }
        };
    });
    const signals = findSignals(candlestickData);
    // Calculate multiple moving averages
    const calculateMA = (data, period) => {
        return data.map((_, index) => {
            if (index < period - 1) return null;
            const slice = data.slice(index - (period - 1), index + 1);
            const average = slice.reduce((sum, item) => sum + item.close, 0) / period;
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
            signal: signals[index]
        }
    }));

    // Current market conditions and trend analysis
    const currentPrice = quoteResult.regularMarketPrice;
    const lastMA20 = ma20[ma20.length - 1];
    const lastMA50 = ma50[ma50.length - 1];
    const marketTrend = currentPrice > lastMA50 ? 'bullish' : 
                       currentPrice < lastMA50 ? 'bearish' : 'neutral';

    // Enhanced entry/exit points calculation
    const recentPrices = candlestickData.slice(-20);
    const highestPrice = Math.max(...recentPrices.map(d => d.high));
    const lowestPrice = Math.min(...recentPrices.map(d => d.low));
    const priceRange = highestPrice - lowestPrice;
    const volatility = recentPrices.reduce((sum, d) => sum + d.analysis.volatility, 0) / 20;

    // Adjust entry/exit points based on volatility
    const volatilityFactor = volatility / 100;
    const entryPoint = currentPrice - (priceRange * Math.min(0.1, volatilityFactor));
    const exitPoint = currentPrice + (priceRange * Math.max(0.2, volatilityFactor * 2));
    const stopLoss = entryPoint - (priceRange * Math.min(0.05, volatilityFactor / 2));

    return {
        symbol:ticker,
        name: quoteResult.longName,
        candlestickData: enrichedData,
        currentPrice,
        averageVolume: quoteResult.averageVolume,
        signals: {
            entryPoint: Number(entryPoint.toFixed(2)),
            exitPoint: Number(exitPoint.toFixed(2)),
            stopLoss: Number(stopLoss.toFixed(2)),
            marketTrend,
            volatility: Number(volatility.toFixed(2))
        },
        metadata: {
            currency: quoteResult.currency,
            exchange: quoteResult.exchange,
            marketCap: quoteResult.marketCap,
            lastUpdated: new Date().toISOString()
        }
    };
    } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
        throw new Error(`Failed to fetch stock data for ${ticker}: ${error.message}`);
    }
  }


// Fetch stock data from Yahoo Finance
async function fetchCarouselTickers(limit = 20) {
    const url = 'https://api.coingecko.com/api/v3/coins/markets';
    const params = {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false
    };

    try {
        const response = await axios.get(url, { params });
            
       return response.data;
    } catch (error) {
        console.error('CoinGecko API Error:', error.message);
        return [];
    }
}
async function filterStocks(limit = 100) {
    try {
        console.log('Fetching crypto tickers...');
        const cryptoTickers = await fetchCryptoTickers(limit);
        console.log('tickers', cryptoTickers);
        console.log(`Processing ${cryptoTickers.length} cryptocurrencies...`);
        
        const results = [];

        // Process sequentially to avoid rate limiting
        for (const crypto of cryptoTickers) {
            try {
                console.log(`Fetching data for ${crypto.id}`);
                const cryptoData = await fetchCryptoData(crypto.id,crypto.image);
                
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
            .filter(crypto => crypto &&
                     crypto.volume >= 1000000 &&
                     parseFloat(crypto.price) >= 0.001)
            .sort((a, b) => parseFloat(b.change_percent) - parseFloat(a.change_percent))
            .slice(0, 30);

        return {
            timestamp: new Date().toISOString(),
            opportunities: tradingOpportunities
        };
    } catch (error) {
        console.error('Analysis failed:', error);
        return {
            timestamp: new Date().toISOString(),
            opportunities: [],
            error: error.message
        };
    }
}
async function fetchCryptoData(coinId,image, retries = 3) {
    console.log('image',image);
    const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
    
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
            const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
            const historicalDataResponse = await fetch(
                `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${sixMonthsAgo}&to=${Math.floor(Date.now() / 1000)}`
            );
            
            if (!historicalDataResponse.ok) {
                throw new Error(`CoinGecko historical data API error: ${historicalDataResponse.status}`);
            }
            
            const historicalData = await historicalDataResponse.json();
            
            // Check if we have any historical data
            if (!historicalData.prices || historicalData.prices.length === 0) {
                console.warn(`No historical data available for ${coinId}`);
                // Return partial data if current data is available
                return {
                    ticker: currentData.symbol.toUpperCase(),
                    name: currentData.name,
                    price: currentData.market_data.current_price.usd?.toFixed(2) || 'N/A',
                    volume: currentData.market_data.total_volume.usd || 'N/A',
                    market_cap: currentData.market_data.market_cap.usd || 'N/A',
                    change_percent: currentData.market_data.price_change_percentage_24h?.toFixed(2) || 'N/A',
                    rsi: 'N/A',
                    ma_50: 'N/A',
                    ma_200: 'N/A',
                    bollinger_upper: 'N/A',
                    bollinger_lower: 'N/A',
                    entry_point: 'N/A',
                    exit_point: 'N/A',
                    image
                };
            }

            // Process historical data
            const closingPrices = historicalData.prices.map(item => item[1]);
            const volumes = historicalData.total_volumes.map(item => item[1]);
            
            // Check if we have enough data for calculations
            if (closingPrices.length < 150) {
                console.warn(`Insufficient historical data for ${coinId} (${closingPrices.length} days available)`);
            }

            // Calculate technical indicators
            const ma50 = closingPrices.length >= 50 ? rollingMean(closingPrices, 50) : null;
            const ma200 = closingPrices.length >= 200 ? rollingMean(closingPrices, 200) : null;
            const rsi = closingPrices.length >= 14 ? calculateRSI(closingPrices.slice(-14)) : null;
            const ma20 = closingPrices.length >= 20 ? rollingMean(closingPrices, 20) : null;
            const std20 = closingPrices.length >= 20 ? rollingStd(closingPrices, 20) : null;

            const lastPrice = closingPrices[closingPrices.length - 1];
            const lastMa20 = ma20 ? ma20[ma20.length - 1] : null;
            const lastStd20 = std20 ? std20[std20.length - 1] : null;

            let upperBB = null;
            let lowerBB = null;
            let entryExitPoints = { entryPoint: null, exitPoint: null };

            if (lastMa20 && lastStd20) {
                upperBB = lastMa20 + (2 * lastStd20);
                lowerBB = lastMa20 - (2 * lastStd20);
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
                change_percent: currentData.market_data.price_change_percentage_24h?.toFixed(2) || 'N/A',
                rsi: rsi?.toFixed(2) || 'N/A',
                ma_50: ma50?.[ma50.length - 1]?.toFixed(2) || 'N/A',
                ma_200: ma200?.[ma200.length - 1]?.toFixed(2) || 'N/A',
                bollinger_upper: upperBB?.toFixed(2) || 'N/A',
                bollinger_lower: lowerBB?.toFixed(2) || 'N/A',
                entry_point: entryExitPoints.entryPoint?.toFixed(2) || 'N/A',
                exit_point: entryExitPoints.exitPoint?.toFixed(2) || 'N/A',
                image
            };
        } catch (error) {
            console.warn(`Attempt ${attempt} failed for ${coinId}:`, error.message);
            
            if (attempt === retries) {
                console.error(`Failed to fetch data for ${coinId} after ${retries} attempts:`, error.message);
                return {
                    ticker: coinId.toUpperCase(),
                    error: error.message,
                    name: 'N/A',
                    price: 'N/A',
                    volume: 'N/A',
                    market_cap: 'N/A',
                    change_percent: 'N/A',
                    rsi: 'N/A',
                    ma_50: 'N/A',
                    ma_200: 'N/A',
                    bollinger_upper: 'N/A',
                    bollinger_lower: 'N/A',
                    entry_point: 'N/A',
                    exit_point: 'N/A',
                    image
                };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
    }
}
async function fetchStockData(ticker,additionalData, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const stock = await yahooFinance.quote(ticker);
            if (!stock) {
                throw new Error('No stock quote data available');
            }
            
            // Calculate time periods
            const period2 = Math.floor(Date.now() / 1000);
            const period1 = Math.floor(new Date().setMonth(new Date().getMonth() - 6) / 1000);
            
            const history = await yahooFinance.historical(ticker, {
                period1: new Date(period1 * 1000),
                period2: new Date(period2 * 1000),
                interval: '1d'
            });

            // Check if we have any historical data
            if (!history || history.length === 0) {
                console.warn(`No historical data available for ${ticker}`);
                // Return partial data if quote is available
                if (stock) {
                    return {

                        additionalData:additionalData,
                        ticker: ticker.replace('-USD', ''),
                        name: stock.longName || stock.shortName || 'N/A',
                        price: stock.regularMarketPrice?.toFixed(2) || 'N/A',
                        volume: stock.regularMarketVolume || 'N/A',
                        market_cap: stock.marketCap || 'N/A',
                        change_percent: stock.regularMarketChangePercent?.toFixed(2) || 'N/A',
                        rsi: 'N/A',
                        ma_50: 'N/A',
                        ma_200: 'N/A',
                        bollinger_upper: 'N/A',
                        bollinger_lower: 'N/A',
                        entry_point: 'N/A',
                        exit_point: 'N/A'
                    };
                }
                throw new Error('No historical data available');
            }

            // Process historical data
            const closingPrices = history.map(item => item.close).filter(price => price != null);
            const openPrices = history.map(item => item.open).filter(price => price != null);
            const volume = history.map(item => item.volume).filter(vol => vol != null);

            // Check if we have enough data for calculations
            if (closingPrices.length < 200) {
                console.warn(`Insufficient historical data for ${ticker} (${closingPrices.length} days available)`);
            }

            // Calculate technical indicators with null checks
            const ma50 = closingPrices.length >= 50 ? rollingMean(closingPrices, 50) : null;
            const ma200 = closingPrices.length >= 200 ? rollingMean(closingPrices, 200) : null;
            const rsi = closingPrices.length >= 14 ? calculateRSI(closingPrices.slice(-14)) : null;
            const ma20 = closingPrices.length >= 20 ? rollingMean(closingPrices, 20) : null;
            const std20 = closingPrices.length >= 20 ? rollingStd(closingPrices, 20) : null;

            const lastPrice = closingPrices[closingPrices.length - 1];
            const lastMa20 = ma20 ? ma20[ma20.length - 1] : null;
            const lastStd20 = std20 ? std20[std20.length - 1] : null;

            let upperBB = null;
            let lowerBB = null;
            let entryExitPoints = { entryPoint: null, exitPoint: null };

            if (lastMa20 && lastStd20) {
                upperBB = lastMa20 + (2 * lastStd20);
                lowerBB = lastMa20 - (2 * lastStd20);
                entryExitPoints = calculateEntryExitPoints(
                    ticker,
                    lastPrice,
                    lowerBB,
                    upperBB
                );
            }

            const change_percent = openPrices.length > 0 ? 
                ((lastPrice - openPrices[openPrices.length - 1]) / 
                 openPrices[openPrices.length - 1]) * 100 : null;

            return {
                additionalData:additionalData,
                ticker: ticker.replace('-USD', ''),
                name: stock.longName || stock.shortName || 'N/A',
                price: lastPrice?.toFixed(2) || 'N/A',
                volume: volume[volume.length - 1] || 'N/A',
                market_cap: stock.marketCap || 'N/A',
                change_percent: change_percent?.toFixed(2) || 'N/A',
                rsi: rsi?.toFixed(2) || 'N/A',
                ma_50: ma50?.[ma50.length - 1]?.toFixed(2) || 'N/A',
                ma_200: ma200?.[ma200.length - 1]?.toFixed(2) || 'N/A',
                bollinger_upper: upperBB?.toFixed(2) || 'N/A',
                bollinger_lower: lowerBB?.toFixed(2) || 'N/A',
                entry_point: entryExitPoints.entryPoint?.toFixed(2) || 'N/A',
                exit_point: entryExitPoints.exitPoint?.toFixed(2) || 'N/A'
            };
        } catch (error) {
            console.warn(`Attempt ${attempt} failed for ${ticker}:`, error.message);
            
            if (attempt === retries) {
                console.error(`Failed to fetch data for ${ticker} after ${retries} attempts:`, error.message);
                // Return a structured error response instead of null
                return {
                    additionalData:additionalData,
                    ticker: ticker.replace('-USD', ''),
                    error: error.message,
                    name: 'N/A',
                    price: 'N/A',
                    volume: 'N/A',
                    market_cap: 'N/A',
                    change_percent: 'N/A',
                    rsi: 'N/A',
                    ma_50: 'N/A',
                    ma_200: 'N/A',
                    bollinger_upper: 'N/A',
                    bollinger_lower: 'N/A',
                    entry_point: 'N/A',
                    exit_point: 'N/A'
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
  if (typeof value !== 'number' || isNaN(value)) {
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
async function fetchTickers(){
    
  
      

  const cryptData = await fetchCarouselTickers();
  return {
  
    data:cryptData
  }
}
function convertToFullTicker(ticker) {
    // Check if the ticker already has the '-USD' suffix
    if (!ticker.includes('-USD')) {
      return `${ticker}-USD`;
    }
    return ticker; // Return the ticker as is if it already contains '-USD'
  }
  




module.exports = {filterStocks,fetchStockData,fetchPennyStockTickers,fetchPennyStockTickers,fetchSP500Tickers,fetchTickers,fetchCarouselTickers,candleStickRecords,candleStickRecordsForDayTrading,fetchCryptoTickers,fetchCryptoData};
