/**
 * Shared tool definitions and execution for AI Agents.
 * Tools are exposed as Gemini function declarations and executed via n8n webhooks.
 */

// ==========================================
// Tool: Get Bookings and Inspector Leave
// ==========================================
const BOOKINGS_WEBHOOK_URL =
  "https://n8n.vucar.vn/webhook/abaa7f92-9690-4677-a8c2-42cd361d46d0"

export const BOOKING_TOOL_DECLARATION = {
  name: "get_bookings_and_leave",
  description:
    "Lấy lịch kiểm định xe và lịch nghỉ phép của các inspector cho một ngày cụ thể. " +
    "Sử dụng khi cần kiểm tra slot trống, đề xuất thời gian hẹn kiểm định, hoặc xác nhận lịch hẹn với khách hàng. " +
    "LUÔN gọi tool này trước khi cam kết bất kỳ thời gian hẹn nào để đảm bảo inspector còn trống.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description:
          "Ngày cần kiểm tra, định dạng YYYY-MM-DD (VD: '2026-03-06'). " +
          "Nếu khách nói 'ngày mai' hoặc 'thứ 2 tuần sau', phải tự tính ra ngày chính xác.",
      },
    },
    required: ["date"],
  },
}

// ==========================================
// Tool: Car Price Lookup (Vucar VAP)
// ==========================================
const getVapApiUrl = () => process.env.VUCAR_VAP_API_URL || ""

// Cache all_car_info for 6 hours (it's a large list that rarely changes)
let carInfoCache: { data: any; fetchedAt: number } | null = null
const CAR_INFO_CACHE_TTL = 6 * 60 * 60 * 1000

export const CAR_PRICE_TOOL_DECLARATION = {
  name: "lookup_car_market_price",
  description:
    "Tra cứu giá xe trên hệ thống Vucar. " +
    "Sử dụng khi cần biết giá thị trường của xe để tư vấn giá, đàm phán, hoặc so sánh với giá khách mong muốn. " +
    "Tool sẽ kiểm tra xe có trong hệ thống không, nếu có sẽ trả về danh sách giá các xe tương tự đang rao bán. " +
    "LUÔN gọi tool này khi tin nhắn liên quan đến giá xe, đàm phán giá, hoặc cần dữ liệu giá thị trường thực tế.",
  parameters: {
    type: "object",
    properties: {
      brand: {
        type: "string",
        description: "Hãng xe (VD: 'Toyota', 'Honda', 'Mazda'). Viết đúng chính tả, viết hoa chữ cái đầu.",
      },
      model: {
        type: "string",
        description: "Mẫu xe (VD: 'Camry', 'City', 'CX-5'). Viết đúng chính tả.",
      },
      year: {
        type: "string",
        description: "Năm sản xuất (VD: '2022'). Phải là 4 chữ số.",
      },
      variant: {
        type: "string",
        description: "Phiên bản xe (VD: '1.5 AT', 'Premium', 'Luxury', 'E'). Tùy chọn, dùng để tăng độ chính xác của giá.",
      },
    },
    required: ["brand", "model", "year"],
  },
}

/**
 * Step 1: Fetch all car info to check if brand/model/year exists in our system.
 * Caches the result for 6 hours.
 */
async function fetchAllCarInfo(): Promise<any> {
  if (carInfoCache && Date.now() - carInfoCache.fetchedAt < CAR_INFO_CACHE_TTL) {
    console.log(`[Agent Tools] Car info: returning cached data`)
    return carInfoCache.data
  }

  const vapUrl = getVapApiUrl()
  const url = `${vapUrl}/values/all_car_info?original=true&unsupported=false&include_colors=false`
  console.log(`[Agent Tools] Fetching all_car_info from VAP...`)

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`VAP all_car_info failed (${res.status})`)
  }

  const data = await res.json()
  // The API returns a nested object: {"Toyota": {"Zace": {"2002": ["GL"]}}}
  carInfoCache = { data, fetchedAt: Date.now() }
  console.log(`[Agent Tools] Car info fetched: ${Object.keys(data).length} brands`)
  return data
}

/**
 * Normalize strings for fuzzy matching (lowercase, trim, remove diacritics).
 */
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[-_]/g, " ")
}

/**
 * Step 2: Check if the car exists in all_car_info.
 * Returns the canonical brand/model names for the API call.
 */
function findCarInList(
  carData: any,
  brand: string,
  model: string,
  year: string
): { brand: string; model: string } | null {
  const normBrand = normalize(brand)
  const normModel = normalize(model)

  if (!carData || typeof carData !== "object") return null

  for (const carBrand of Object.keys(carData)) {
    if (normalize(carBrand) === normBrand) {
      const modelsObj = carData[carBrand]
      if (!modelsObj || typeof modelsObj !== "object") continue

      for (const carModel of Object.keys(modelsObj)) {
        if (normalize(carModel) === normModel) {
          // Found matching brand and model, return exact keys from API
          return { brand: carBrand, model: carModel }
        }
      }
    }
  }

  return null
}

/**
 * Step 3: Fetch car listings/prices from VAP.
 */
async function fetchCarListings(brand: string, model: string, year: string): Promise<any> {
  const vapUrl = getVapApiUrl()
  const url = `${vapUrl}/listings/car?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&manufacture_date=${encodeURIComponent(year)}`
  console.log(`[Agent Tools] Fetching car listings: ${url}`)

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    throw new Error(`VAP listings/car failed (${res.status})`)
  }

  return await res.json()
}

// ==========================================
// Knowledge Document Tools
// ==========================================
interface KnowledgeDoc {
  name: string
  docId: string
  description: string
}

const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    name: "hanoi_market_knowledge",
    docId: "1vEOx4Po6fZwA2Nc8vEiNVeNyaVSzMWGK-cxgnOhMcXs",
    description:
      "Tra cứu kiến thức chiến lược bán hàng và thị trường ô tô Hà Nội. " +
      "Sử dụng khi cần: tâm lý khách hàng miền Bắc, kỹ thuật đàm phán cho thị trường Hà Nội, " +
      "tốc độ giao dịch, 3 nhóm chân dung khách hàng (Quản lý quyết đoán, Thực dụng, Cơ hội), " +
      "best practices chốt deal và xử lý từ chối cho khách Hà Nội/miền Bắc. " +
      "LUÔN gọi tool này khi tin nhắn liên quan đến chiến lược, tư vấn, hoặc insight hành vi bán xe ở Hà Nội.",
  },
  {
    name: "general_legal_knowledge",
    docId: "1XJZE5v6ggGy-tn4owKCSOSU_ijARoLINQ61q8VAnJGo",
    description:
      "Tra cứu kiến thức pháp lý cơ bản liên quan đến mua bán ô tô. " +
      "Sử dụng khi cần tư vấn pháp lý cho khách hàng: thủ tục sang tên, giấy tờ xe, hợp đồng mua bán, " +
      "trách nhiệm pháp lý của các bên, quy định về đăng kiểm, bảo hiểm xe, và các vấn đề pháp lý thường gặp. " +
      "LUÔN gọi tool này khi khách hỏi về thủ tục, giấy tờ, hoặc vấn đề pháp lý.",
  },
  {
    name: "pricing_negotiation_skills",
    docId: "14GRgFEjq_VGC5FhZFoHE8do0aeYqDTwaxg7PqgeAZXM",
    description:
      "Tra cứu kỹ năng thương lượng giá xe. " +
      "Sử dụng khi cần đàm phán giá với khách hàng: chiến thuật neo giá, xử lý phản đối về giá, " +
      "cách trình bày giá trị xe, kỹ thuật nhượng bộ có điều kiện, và cách chốt deal khi gap giá lớn. " +
      "LUÔN gọi tool này khi cần thương lượng hoặc tư vấn chiến lược giá.",
  },
  {
    name: "vucar_policy_fee_rules",
    docId: "1omjdWK13mEVcBotK_xuLA0J0Y8_6-Or_pNJr6yo6S-Q",
    description:
      "Tra cứu chính sách phí và quy định dịch vụ của Vucar. " +
      "Sử dụng khi khách hàng hỏi về chi phí sử dụng dịch vụ Vucar: phí dịch vụ, phí kiểm định, " +
      "chính sách hoa hồng, điều kiện sử dụng, quyền lợi khách hàng, và các gói dịch vụ. " +
      "LUÔN gọi tool này khi khách hỏi về giá dịch vụ, phí, hoặc chính sách của Vucar.",
  },
]

// In-memory cache for docs (1 hour TTL per doc)
const docCache = new Map<string, { content: string; fetchedAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Fetch a Google Doc as plain text with caching.
 */
async function fetchGoogleDoc(docId: string, toolName: string): Promise<string> {
  const cached = docCache.get(docId)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[Agent Tools] ${toolName}: returning cached content (${cached.content.length} chars)`)
    return cached.content
  }

  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`
  console.log(`[Agent Tools] Fetching ${toolName} doc...`)
  const res = await fetch(url)

  if (!res.ok) {
    console.warn(`[Agent Tools] ${toolName} fetch failed (${res.status})`)
    return JSON.stringify({ error: `Failed to fetch document (${res.status})` })
  }

  const content = await res.text()
  docCache.set(docId, { content, fetchedAt: Date.now() })
  console.log(`[Agent Tools] ${toolName} fetched: ${content.length} chars`)
  return content
}

// Build function declarations from the docs array
const KNOWLEDGE_TOOL_DECLARATIONS = KNOWLEDGE_DOCS.map((doc) => ({
  name: doc.name,
  description: doc.description,
  parameters: { type: "object", properties: {} },
}))

/**
 * Execute a tool call from Gemini's function calling response.
 * Returns the result as a string for feeding back to Gemini.
 */
export async function executeToolCall(
  functionName: string,
  args: Record<string, any>
): Promise<string> {
  // Check if it's a knowledge doc tool
  const knowledgeDoc = KNOWLEDGE_DOCS.find((d) => d.name === functionName)
  if (knowledgeDoc) {
    try {
      return await fetchGoogleDoc(knowledgeDoc.docId, knowledgeDoc.name)
    } catch (err) {
      console.error(`[Agent Tools] ${knowledgeDoc.name} error:`, err)
      return JSON.stringify({ error: String(err) })
    }
  }

  switch (functionName) {
    case "get_bookings_and_leave": {
      const date = args.date
      if (!date) return JSON.stringify({ error: "Missing date parameter" })

      try {
        console.log(`[Agent Tools] Calling booking tool for date: ${date}`)
        const res = await fetch(BOOKINGS_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ date }),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.warn(`[Agent Tools] Booking tool failed (${res.status}): ${errText.slice(0, 200)}`)
          return JSON.stringify({ error: `API returned ${res.status}` })
        }

        const data = await res.json()
        console.log(`[Agent Tools] Booking tool returned data for ${date}`)
        return JSON.stringify(data)
      } catch (err) {
        console.error(`[Agent Tools] Booking tool error:`, err)
        return JSON.stringify({ error: String(err) })
      }
    }

    case "lookup_car_market_price": {
      const { brand, model, year, variant } = args
      if (!brand || !model || !year) {
        return JSON.stringify({ error: "Missing required parameters: brand, model, year" })
      }

      try {
        // Step 1: Get all car info and check if this car exists
        const carList = await fetchAllCarInfo()
        const match = findCarInList(carList, brand, model, year)

        if (!match) {
          console.log(`[Agent Tools] Car not found in system: ${brand} ${model} ${year}`)
          return JSON.stringify({
            found: false,
            message: `Xe ${brand} ${model} ${year} không có trong hệ thống giá của Vucar. Không có dữ liệu giá thị trường cho xe này.`,
          })
        }

        console.log(`[Agent Tools] Car found: ${match.brand} ${match.model} ${year} — fetching prices...`)

        // Step 2: Fetch actual price listings using canonical names
        const listings = await fetchCarListings(match.brand, match.model, year)

        // Step 3: Check variant match for confidence
        let variantMatchStatus = "Not requested"
        let hasVariantMatch = false
        if (variant) {
          const normVariant = normalize(variant)
          const listArray = Array.isArray(listings) ? listings : (listings.data || listings.results || [])

          hasVariantMatch = listArray.some((item: any) => {
            const v = normalize(item.variant || "")
            return v !== "" && (v.includes(normVariant) || normVariant.includes(v))
          })

          variantMatchStatus = hasVariantMatch
            ? "Exact variant match found in listings (high confidence)"
            : "No exact variant match found in listings (lower confidence for negotiation)"
        }

        return JSON.stringify({
          found: true,
          brand: match.brand,
          model: match.model,
          year,
          requested_variant: variant || null,
          has_variant_match: hasVariantMatch,
          variant_match_status: variantMatchStatus,
          listings,
        })
      } catch (err) {
        console.error(`[Agent Tools] Car price lookup error:`, err)
        return JSON.stringify({ error: String(err) })
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${functionName}` })
  }
}

/**
 * All custom function declarations for agents.
 */
export function getAgentTools() {
  return [
    {
      function_declarations: [
        BOOKING_TOOL_DECLARATION,
        CAR_PRICE_TOOL_DECLARATION,
        ...KNOWLEDGE_TOOL_DECLARATIONS,
      ],
    },
  ]
}
