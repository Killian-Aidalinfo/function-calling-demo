import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { Mistral } from '@mistralai/mistralai';

const apiKey = Bun.env.MISTRAL_AI_API_KEY;

const client = new Mistral({ apiKey: apiKey });

const factory = createFactory();

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

interface ImageResponse {
  choices?: {
    message: {
      content: string;
    };
  }[];
}
const tools: any[] = [
  {
    "type": "function",
    "function": {
      "name": "retrieve_product_information",
      "description": "Retrieve detailed information about a product including manufacturer, description, quantity, and supplier.",
      "parameters": {
        "type": "object",
        "properties": {
          "product_name": {
            "type": "string",
            "description": "The name of the product to retrieve information about.",
          },
          "manufacture": {
            "type": "string",
            "description": "The name of the manufacturer or brand of the product.",
          },
          "description": {
            "type": "string",
            "description": "A brief description of the product, including its features and specifications.",
          },
          "fabricant": {
            "type": "string",
            "description": "The company responsible for producing the product.",
          },
          "qty": {
            "type": "integer",
            "description": "The quantity of the product available in stock.",
          }
        },
        "required": ["product_name","manufacture", "description", "fabricant", "qty"],
      },
    },
  }
];

async function analyzeImage(base64Image: string) {
  try {
    const imageResponse = await client.chat.complete({
    model: "pixtral-12b-2409",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Please analyze the provided image. If it contains a table, extract each row and convert it into a structured JSON format. For each row, use the exact values without filling in missing fields with data from other rows. If a field is empty, leave it empty. Ensure that each JSON object represents exactly one row of the table. Thank you!" },
          {
            type: "image_url",
            imageUrl: `data:image/jpeg;base64,${base64Image}`,
          },
        ],
      },
    ],
  }) as ImageResponse;
  return imageResponse?.choices?.[0]?.message?.content;
  } catch (error) {
    throw new HTTPException(500, { message: `Error analyzing image : ${error}` });
  }
}

async function resultFunctionCalling(text: string){
    const result = await client.chat.complete({
    model: "mistral-small-latest",
    messages: [{ role: "user", content: `Extract all information from the provided text and format the response using the tools in JSON format. Do not reply with any text; use only the provided tools to format the response. The text: ${text}` }],
    tools: tools,
    tool_choice: "auto",
  } as any);
  console.log("(1)", result);
  console.log("(2)", result?.choices?.[0]?.message);
  console.log("(3)", result?.choices?.[0]?.message?.content);
  const results = [];
  //Execute les functions calling si elles existent
  if (result?.choices?.[0]?.message?.toolCalls) { 
    for (const call of result.choices[0].message.toolCalls) {
      // Récupère le nom de la fonction et les arguments
      const functionName = call.function.name;
      const resultFunction = JSON.parse(call.function.arguments as string);
      console.log("The function name :", functionName);
      console.log("The function result :", resultFunction);
      // Push du résultat de la fonction dans les résultats
      results.push(resultFunction)
    }
    console.log("results", results)
    return results;
  }
  else {
    return result?.choices?.[0]?.message?.content;
  }  
}

async function extractFile(request: any){
  const formData = await request.req.formData();
  const file = formData.get("file") as UploadedFile;
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "No file uploaded" });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString("base64");
  return base64Image;
}

export const ExtractorFunction = factory.createHandlers(async (c) => {
  const base64Image = await extractFile(c);
  const analyzeResult = await analyzeImage(base64Image);
  const result = await resultFunctionCalling(analyzeResult as string) as Array<JSON>; 
  return c.json(result);
});
