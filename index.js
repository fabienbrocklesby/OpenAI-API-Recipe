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

async function getRecipe(recipeName, calories, budget) {
	let prompt = `Provide a recipe`;
	if (recipeName) {
		prompt += ` for ${recipeName}`;
	}
	if (calories) {
		prompt += ` with approximately ${calories} calories`;
	}
	if (budget) {
		prompt += ` that can be made for under ${budget} dollars`;
	}
	prompt += `. Please format the response with detailed nutritional information, ingredients, directions, and price information in separate sections. Start with "Nutritional Information:" and provide exact figures for calories, protein, carbohydrates, and fat. Follow this with "Ingredients:" and a list of ingredients with quantities. Then provide "Directions:" followed by step-by-step cooking instructions. Finally, provide "Estimated Price:" followed by the price estimate.`;

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
	console.log(recipeText);

	const parsedRecipe = parseRecipe(recipeText);
	return parsedRecipe;
}

function parseRecipe(text) {
	const lowerCaseText = text.toLowerCase();
	const trimmedText = lowerCaseText.replace(/ +/g, " ");

	const priceStartIndex = trimmedText.search(/-[^-\n]+:\s*\$[\d.]+/);

	const sections = [
		trimmedText.split("nutritional information:\n")[1] || "",
		trimmedText.split("\n\ningredients:\n")[1] || "",
		trimmedText.split("\n\ndirections:\n")[1] || "",
		priceStartIndex !== -1 ? trimmedText.slice(priceStartIndex) : "",
	];

	const nutritionalInfoSection = sections[0].split("\n\n")[0];
	const ingredientsSection = sections[1].split("\n\n")[0];
	const directionsSection = sections[2].split("\n\n")[0];
	const priceSection = sections[3];

	const ingredientsHTML = ingredientsSection.replace(/\n- /g, "<br>- ");
	const directionsHTML = directionsSection.replace(/\n/g, "<br>");
	const nutritionalInfoHTML = nutritionalInfoSection.replace(/\n- /g, "<br>- ");

	return `<h2>Nutritional Information:</h2><p>${nutritionalInfoHTML}</p><h2>Ingredients:</h2><p>${ingredientsHTML}</p><h2>Directions:</h2><p>${directionsHTML}</p><h2>Estimated Price:</h2><p>${priceSection}</p>`;
}

app.post("/recipe", async (req, res) => {
	const recipeName = req.body.recipe;
	const calories = req.body.calories;
	const budget = req.body.budget;

	// if (!recipeName) {
	// 	return res.status(400).send("Please specify a recipe name");
	// }

	try {
		const recipeData = await getRecipe(recipeName, calories, budget);
		res.send(recipeData);
	} catch (error) {
		console.error(error);
		res.status(500).send("Internal Server Error");
	}
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening on port ${port}`));
