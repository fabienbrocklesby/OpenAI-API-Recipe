const express = require("express");
const OpenAI = require("openai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function getRecipe(recipeName, calories, servingSize, budget) {
	let prompt = `Provide a detailed recipe`;
	if (recipeName) {
		prompt += ` for "${recipeName}"`;
	}
	if (calories) {
		prompt += ` with approximately ${calories} calories`;
	}
	if (servingSize) {
		prompt += ` that serves for ${servingSize} people`;
	}
	if (budget) {
		prompt += ` that can be made for under ${budget} dollars`;
	}
	prompt += `. Please format the response as a JSON object with the following properties: "servingSize", "nutritionalInformation", "ingredients", "directions", and "estimatedPrice". The "servingSize" property should be a number representing the number of servings. The "nutritionalInformation" property should be an object with properties for "calories", "protein", "carbohydrates", and "fat". The "ingredients" property should be an array of objects, each with properties for "name", "quantity", and "price". The "directions" property should be an array of strings, each representing a step in the cooking instructions. The "estimatedPrice" property should be a number representing the total price estimate of all ingredients.`;

	const messages = [
		{
			role: "system",
			content: "You are a helpful assistant.",
		},
		{
			role: "user",
			content: prompt,
		},
	];

	const response = await openai.chat.completions.create({
		model: "gpt-3.5-turbo",
		response_format: { type: "json_object" },
		messages: messages,
		max_tokens: 1500,
		temperature: 0.7,
	});

	let recipeText = response["choices"][0]["message"]["content"];
	let parsedRecipe;

	recipeText = recipeText.replace("```json", "").replace("```", "").trim();

	console.log(recipeText);
	try {
		parsedRecipe = JSON.parse(recipeText);
	} catch (error) {
		console.error("Error parsing JSON:", error);
		parsedRecipe = { error: "Error parsing recipe" };
	}
	return parsedRecipe;
}

app.post("/recipe", async (req, res) => {
	const recipeName = req.body.recipe;
	const calories = req.body.calories;
	const servingSize = req.body.servingSize;
	const budget = req.body.budget;

	try {
		const recipeData = await getRecipe(
			recipeName,
			calories,
			servingSize,
			budget
		);
		res.send(recipeData);
	} catch (error) {
		console.error(error);
		res.status(500).send("Internal Server Error");
	}
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening on port ${port}`));
