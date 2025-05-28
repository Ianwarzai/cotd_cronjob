const cron = require("node-cron");
const CronExpression = require("./cron_expression");
var stock_types = ["Entery", "Closing"];
var days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
var trading_types = ["dayTrading", "swingTrading", "longTerm"];
var trading_shift_counter = 0;
const pool = require("../db_config");
const {
  filterStocks,
  fetchPennyStockTickers,
  fetchSP500Tickers,
  fetchTickers,
  candleStickRecords,
  fetchCryptoTickers,
} = require("../services/stockDataService");
const { fetchStockData } = require("../services/binanceServer");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const prompts = [
  "AAPL is a bullish trade today because its technical indicators, including the Bollinger Bands, show the stock trading near its lower band, suggesting a potential bounce. The Relative Strength Index (RSI) is hovering near the oversold zone, indicating a buying opportunity. Additionally, the Moving Average Convergence Divergence (MACD) has recently crossed above its signal line, signaling momentum in the upward direction. With these indicators pointing towards a reversal, this stock appears to be an ideal buy right now.",
  "The bullish case for AAPL is supported by several key technical factors. This stock is currently approaching a strong support level, indicating potential resistance to further declines. The RSI suggests the stock is oversold, making it a prime candidate for a rebound. Moreover, the MACD histogram has begun to tick upward, signaling a shift in momentum. Combined with its historical strength, these technical indicators make this a promising buy today.",
  "AAPL is an attractive bullish trade today, particularly due to its technical setup. This stock has been respecting a critical support level, and the RSI is inching closer to the oversold territory, highlighting a potential buying opportunity. Additionally, the Chaikin Money Flow (CMF) indicator shows positive inflows, suggesting strong institutional interest. This mix of indicators underlines the potential for upward movement, making it an ideal stock to consider buying today.",
  "AAPL exhibits strong bullish potential based on its technical indicators. The price of this stock is approaching a significant resistance level that, if broken, could lead to a substantial upward move. The RSI is currently at a neutral level, leaving room for further gains. Additionally, the On-Balance Volume (OBV) indicator is rising, showing that volume supports the price movement. These factors, combined with its solid market position, make this stock a good buy today.",
  "The bullish outlook for AAPL is bolstered by its technical indicators, such as trading near a major trendline support, which has historically been a launching point for price increases. The RSI indicates oversold conditions, suggesting this stock is undervalued. Furthermore, the Stochastic Oscillator has crossed into the bullish zone, reinforcing the case for a rebound. These signals, along with continued innovation, make this stock a compelling buy today.",
  "AAPL stands out as a bullish trade because it is approaching a critical Fibonacci retracement level, which could act as strong support and trigger a reversal. The RSI is showing signs of a potential move from oversold conditions, while the MACD line has crossed above the signal line, indicating the start of an upward trend. With these indicators aligning, this stock appears to be a smart buy for today.",
  "AAPL is a bullish trade today, supported by its technical indicators showing it is testing a strong moving average support, which has historically led to price rebounds. The RSI is trending upwards from oversold conditions, and the Average Directional Index (ADX) indicates a strengthening bullish trend. Given these positive signals, combined with strong fundamentals, this stock looks like an ideal buy.",
  "The bullish case for AAPL is underscored by technical indicators that show it bouncing off a significant support level, which could lead to a rally. The RSI is beginning to rise, moving out of oversold territory, while the Bollinger Bands suggest that the price could expand upwards. Additionally, the MACD is showing a bullish crossover, signaling momentum is shifting to the upside. These indicators make this stock an attractive buy today.",
  "AAPL presents a bullish trading opportunity as it approaches a key support zone, which has previously acted as a springboard for upward moves. The RSI is pointing towards an oversold condition, and the Parabolic SAR (Stop and Reverse) has flipped to indicate a bullish trend. With these technical indicators signaling a potential uptrend, this stock stands out as a strong buy today.",
];

cron.schedule(CronExpression.MONDAY_TO_FRIDAY_AT_9AM, async () => {
  console.log("Monday to friday at 9am");
  let stock_data = { dayTrading: await getDayTradingCryptos(7) };
  await storStockData(stock_types[0], stock_data);
});

cron.schedule(CronExpression.MONDAY_TO_FRIDAY_AT_4_30PM, async () => {
  console.log("Monday to friday  at 4:30 pm");
  let stock_data = { dayTrading: await getDayTradingCryptos(7) };
  await storStockData(stock_types[1], stock_data);
});
async function filterCrypto(limit = 700) {
  try {
    console.log("Fetching crypto tickers...");
    const cryptoTickers = await fetchCryptoTickers(limit);

    console.log(`Processing ${cryptoTickers.length} cryptocurrencies...`);
    const results = [];

    // Process in batches to avoid rate limiting
    const batchSize = 1;
    for (let i = 0; i < cryptoTickers.length; i += batchSize) {
      const batch = cryptoTickers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((crypto) => fetchStockData(crypto.symbol, crypto))
      );
      results.push(...batchResults.filter(Boolean));
      await sleep(1000); // Rate limiting delay between batches
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

    return tradingOpportunities;
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      timestamp: new Date().toISOString(),
      opportunities: [],
      error: error.message,
    };
  }
}
function calculateTrendPercentage(crypto) {
  try {
    // Gather all available data points
    const price = parseFloat(crypto.price);
    const ma7 = parseFloat(crypto.ma_7);
    const ma25 = parseFloat(crypto.ma_25);
    const ma50 = parseFloat(crypto.ma_50);
    const ma99 = parseFloat(crypto.ma_99);
    const rsi = parseFloat(crypto.rsi);
    const bollingerUpper = parseFloat(crypto.bollinger_upper);
    const bollingerLower = parseFloat(crypto.bollinger_lower);
    const changePercent = parseFloat(crypto.change_percent);

    // Initialize scores for different components
    let trendScore = 0;
    let componentsUsed = 0;

    // 1. Price position relative to moving averages (weight: 25%)
    let maScore = 0;
    let maCount = 0;

    if (!isNaN(price)) {
      if (!isNaN(ma7) && ma7 > 0) {
        maScore += price > ma7 ? 100 : 0;
        maCount++;
      }

      if (!isNaN(ma25) && ma25 > 0) {
        maScore += price > ma25 ? 100 : 0;
        maCount++;
      }

      if (!isNaN(ma50) && ma50 > 0) {
        maScore += price > ma50 ? 100 : 0;
        maCount++;
      }

      if (!isNaN(ma99) && ma99 > 0) {
        maScore += price > ma99 ? 100 : 0;
        maCount++;
      }
    }

    if (maCount > 0) {
      trendScore += (maScore / maCount) * 0.25;
      componentsUsed++;
    }

    // 2. RSI position (weight: 25%)
    // RSI ranges from 0-100:
    // 0-30: oversold (potentially bullish)
    // 30-70: neutral
    // 70-100: overbought (potentially bearish)
    let rsiScore = 0;

    if (!isNaN(rsi)) {
      if (rsi <= 30) {
        // Oversold condition (potentially bullish) - higher score
        rsiScore = 100 - (30 - rsi) * (100 / 30);
      } else if (rsi <= 70) {
        // Neutral zone - scale to 50-100
        rsiScore = 50 + (rsi - 30) * (50 / 40);
      } else {
        // Overbought condition (potentially bearish) - lower score
        rsiScore = 50 - (rsi - 70) * (50 / 30);
      }

      trendScore += rsiScore * 0.25;
      componentsUsed++;
    }

    // 3. Bollinger Bands position (weight: 25%)
    let bbScore = 0;

    if (
      !isNaN(price) &&
      !isNaN(bollingerUpper) &&
      !isNaN(bollingerLower) &&
      bollingerUpper > bollingerLower
    ) {
      // Calculate where price is within the bands (0-100%)
      const bandWidth = bollingerUpper - bollingerLower;
      const positionInBand = Math.max(
        0,
        Math.min(100, ((price - bollingerLower) / bandWidth) * 100)
      );

      // Near lower band (0-25%) is bullish: score 75-100
      // Middle of bands (25-75%) is neutral: score 25-75
      // Near upper band (75-100%) is bearish: score 0-25
      if (positionInBand <= 25) {
        bbScore = 75 + positionInBand;
      } else if (positionInBand <= 75) {
        bbScore = 75 - (positionInBand - 25) * (50 / 50);
      } else {
        bbScore = 25 - (positionInBand - 75) * (25 / 25);
      }

      trendScore += bbScore * 0.25;
      componentsUsed++;
    }

    // 4. Recent price change percentage (weight: 25%)
    let changeScore = 0;

    if (!isNaN(changePercent)) {
      // Map change percentage to a 0-100 score
      // -10% or worse: 0
      // +10% or better: 100
      // Linear scale in between
      changeScore = Math.max(0, Math.min(100, (changePercent + 10) * 5));

      trendScore += changeScore * 0.25;
      componentsUsed++;
    }

    // If we couldn't calculate any components, return a default value
    if (componentsUsed === 0) {
      return 50; // Neutral default
    }

    // Normalize the score based on components used
    trendScore = trendScore / componentsUsed;

    // Ensure the score is within 0-100 range
    return Math.max(0, Math.min(100, trendScore)).toFixed(2);
  } catch (error) {
    console.error("Error calculating trend percentage:", error);
    return 50; // Return neutral value on error
  }
}
cron.schedule(CronExpression.EVERY_7_MINUTES, async () => {
  console.log("EVERY_7_MINUTES");
  let trading_data = {};
  trading_data = { dayTrading: await getDayTradingCryptos(30) };

  // if(trading_shift_counter===0){
  // } else if( trading_shift_counter===1){
  //   trading_data = {swingTrading: await getSwingTradingStocks(30)}
  // }else if( trading_shift_counter===2){
  //   trading_data = {longTerm: await getLongTermStocks(30)}
  // }
  await storTradingData(trading_types[0], trading_data);
  // trading_shift_counter++;
  // if(trading_shift_counter>2){
  //   trading_shift_counter=0;
  // }
});

async function storTradingData(trading_type, trading_data) {
  try {
    console.log(`[storTradingData] Saving data for: ${trading_type}`);
    console.log(
      `[storTradingData] Data: ${JSON.stringify(trading_data, null, 2)}`
    );

    let trading_hostory = await pool.query(
      `SELECT * FROM trading_history WHERE trading_type = $1`,
      [trading_type]
    );

    if (trading_hostory.rows && trading_hostory.rows.length > 0) {
      let res = await pool.query(
        `UPDATE trading_history SET trading_data = $1 WHERE trading_type = $2`,
        [trading_data, trading_type]
      );
      console.log(
        `[storTradingData] Updated existing record for: ${trading_type}`
      );
    } else {
      const result = await pool.query(
        `INSERT INTO trading_history (trading_data, trading_type) VALUES ($1, $2);`,
        [trading_data, trading_type]
      );
      console.log(`[storTradingData] Inserted new record for: ${trading_type}`);
    }
  } catch (error) {
    console.error(`[storTradingData] Error: ${error.message}`);
    console.error(error.stack);
  }
}

async function storStockData(stock_type, stock_data) {
  try {
    let day_index = new Date().getDay();
    let stock_day = days[day_index];

    let stock_hostory = await pool.query(
      `SELECT * FROM stock_history WHERE stock_type = $1 AND stock_day = $2`,
      [stock_type, stock_day]
    );

    if (stock_hostory.rows && stock_hostory.rows.length > 0) {
      let res = await pool.query(
        `UPDATE stock_history SET stock_data = $1 WHERE stock_type = $2 AND stock_day = $3`,
        [stock_data, stock_type, stock_day]
      );
    } else {
      const result = await pool.query(
        `INSERT INTO stock_history (
             stock_data, stock_type, stock_day
              ) VALUES ($1, $2, $3);`,
        [stock_data, stock_type, stock_day]
      );
    }
  } catch (error) {
    console.log(error);
  }
}

async function getDayTradingCryptos(limit = 7) {
  try {
    console.log(`[getDayTradingCryptos] Fetching crypto data...`);
    const cryptocurrencies = await filterCrypto();

    if (!cryptocurrencies || cryptocurrencies.length === 0) {
      console.warn("[getDayTradingCryptos] No crypto data fetched.");
      return [];
    }

    console.log(
      `[getDayTradingCryptos] Processing top ${limit} out of ${cryptocurrencies.length}`
    );

    const filteredCrypto = await Promise.all(
      cryptocurrencies.slice(0, limit).map(async (crypto) => {
        try {
          const trend_percentage = calculateTrendPercentage(crypto);
          const analysis = await generateAnalysis(crypto.ticker);

          return {
            ...crypto,
            trend_percentage: parseFloat(trend_percentage),
            analysis,
          };
        } catch (err) {
          console.error(
            `[getDayTradingCryptos] Error processing ${crypto.ticker}: ${err.message}`
          );
          return null;
        }
      })
    );

    const cleaned = filteredCrypto.filter(Boolean);

    console.log(
      `[getDayTradingCryptos] Completed. Total valid records: ${cleaned.length}`
    );
    return cleaned;
  } catch (error) {
    console.error("[getDayTradingCryptos] Critical error:", error.message);
    return [];
  }
}

// async function getDayTradingCryptos(limit = 7) {
//   try {
//     const cryptocurrencies = await filterCrypto();

//     const filteredCrypto = cryptocurrencies
//       .slice(0, limit)
//       .map(crypto => {

//         let trend_percentage = null;

//         // Get values needed for calculations
//         const price = parseFloat(crypto.price);
//         const ma50 = parseFloat(crypto.ma_50);
//         const ma200 = parseFloat(crypto.ma_200);

//         // Primary calculation: price vs 50-day MA (most reliable with your data)
//         if (!isNaN(price) && !isNaN(ma50) && ma50 > 0) {
//           // Take absolute value to ensure it's positive
//           trend_percentage = Math.abs(((price - ma50) / ma50 * 100));
//         }
//         // Alternative: If ma50 is invalid but ma200 exists
//         else if (!isNaN(price) && !isNaN(ma200) && ma200 > 0) {
//           trend_percentage = Math.abs(((price - ma200) / ma200 * 100));
//         }
//         // If neither moving average is available, we could use change_percent
//         else if (crypto.change_percent && crypto.change_percent !== 'N/A') {
//           const change = parseFloat(crypto.change_percent);
//           trend_percentage = !isNaN(change) ? Math.abs(change) : 0;
//         }
//         // Default fallback
//         else {
//           trend_percentage = 1.0; // Default minimum value
//         }

//         // Cap at 100 and ensure it's not negative
//         trend_percentage = Math.min(100, Math.max(0, trend_percentage)).toFixed(2);

//         // Convert to number for final output
//         trend_percentage = parseFloat(trend_percentage);

//         return {
//           ...crypto,
//           trend_percentage,
//           analysis: generateAnalysis(crypto.ticker)
//         };
//       });

//     return filteredCrypto;
//   } catch (error) {
//     console.error('Error in getDayTradingCrypto:', error);
//     return {error: error.message}
//   }
// }

// async function getDayTradingCryptos(limit = 7) {
//   try {
//     const cryptocurrencies = await filterCrypto();

//     const filteredCrypto = cryptocurrencies.slice(0, limit).map((crypto) => {
//       // Calculate trend percentage with our new method
//       const trend_percentage = calculateTrendPercentage(crypto);

//       return {
//         ...crypto,
//         trend_percentage: parseFloat(trend_percentage),
//         analysis: generateAnalysis(crypto.ticker),
//       };
//     });

//     return filteredCrypto;
//   } catch (error) {
//     console.error("Error in getDayTradingCrypto:", error);
//     return { error: error.message };
//   }
// }

function generateAnalysiss(ticker) {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)].replace(
    "AAPL",
    ticker
  );
  return prompt;
}

const axios = require("axios");
async function generateAnalysis(ticker) {
  const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
  const DEEPSEEK_API_KEY = "sk-99da1258ccd647bf8f0df5eef5b37931"; // Replace with your actual DeepSeek API key

  const prompt = `Provide a concise financial analysis for the cryptocurrency ${ticker}. Include insights on whale accumulation, tweet volume with sentiment, and liquidity trends on decentralized exchanges. Format the response as a bullet-point list with short sentences, for example:
    - Whale accumulation surged 4x
    - Tweet volume up +167% with bullish sentiment
    - Liquidity strong, no dev sell-offs`;

  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a cryptocurrency market analyst providing concise, actionable insights based on whale activity, social media sentiment, and decentralized exchange liquidity.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(response.data.usage);

    const analysis = response.data.choices[0].message.content.trim().toString();
    return analysis;
  } catch (error) {
    console.error("DeepSeek API Error:", error.response?.data || error.message);
    return "Analysis currently unavailable. Please try again later.";
  }
}
