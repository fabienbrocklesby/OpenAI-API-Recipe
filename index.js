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

async function getRecipe(userInput) {
	const prompt = `Provide a recipe for ${userInput}. Please format the response with detailed nutritional information, ingredients, and directions information in separate sections. Start with "Nutritional Information:" and provide exact figures for calories, protein, carbohydrates, and fat. Follow this with "Ingredients:" and a list of ingredients with quantities. Finally, provide "Directions:" followed by step-by-step cooking instructions.`;
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
		messages: messages,
		max_tokens: 1500,
		temperature: 0.7,
	});

	const recipeText = response["choices"][0]["message"]["content"];

	const parsedRecipe = parseRecipe(recipeText);
	return parsedRecipe;
}

function parseRecipe(text) {
	const lowerCaseText = text.toLowerCase();
	const trimmedText = lowerCaseText.replace(/ +/g, " ");

	const nutritionalInfoSection = trimmedText
		.split("nutritional information:\n")[1]
		?.split("\n\ningredients:")[0];
	const ingredientsSection = trimmedText
		.split("\n\ningredients:\n")[1]
		?.split("\n\ndirections:")[0];
	const directionsSection = trimmedText.split("\n\ndirections:\n")[1];

	const ingredientsHTML = ingredientsSection
		? ingredientsSection.replace(/\n- /g, "<br>- ")
		: "";
	const directionsHTML = directionsSection
		? directionsSection.replace(/\n/g, "<br>")
		: "";
	const nutritionalInfoHTML = nutritionalInfoSection
		? nutritionalInfoSection.replace(/\n- /g, "<br>- ")
		: "";

	return `<h2>Nutritional Information:</h2><p>${nutritionalInfoHTML}</p><h2>Ingredients:</h2><p>${ingredientsHTML}</p><h2>Directions:</h2><p>${directionsHTML}</p>`;
}

app.post("/recipe", async (req, res) => {
	console.log(req.body);
	const recipeName = req.body.recipe;

	if (!recipeName) {
		return res.status(400).send("Please specify a recipe name");
	}

	try {
		const recipeData = await getRecipe(recipeName);
		res.send(recipeData);
	} catch (error) {
		console.error(error);
		res.status(500).send("Internal Server Error");
	}
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening on port ${port}`));
