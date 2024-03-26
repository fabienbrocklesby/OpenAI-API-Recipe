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
			content: "You are a helpful assistant with dietary knowledge.",
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

app.post("/calculateHealthMetrics", async (req, res) => {
	const age = req.body.age;
	const weight = req.body.weight;
	const height = req.body.height;
	const gender = req.body.gender;
	const activityLevel = req.body.activityLevel;

	let bmr;
	if (gender === "male") {
		bmr = 10 * weight + 6.25 * height - 5 * age + 5;
	} else if (gender === "female") {
		bmr = 10 * weight + 6.25 * height - 5 * age - 161;
	} else {
		res.status(400).send("Invalid gender");
		return;
	}

	const heightInMeters = height / 100;
	const bmi = weight / (heightInMeters * heightInMeters);

	let maintenanceCalories;
	switch (activityLevel) {
		case "sedentary":
			maintenanceCalories = bmr * 1.2;
			break;
		case "light":
			maintenanceCalories = bmr * 1.375;
			break;
		case "moderate":
			maintenanceCalories = bmr * 1.55;
			break;
		case "active":
			maintenanceCalories = bmr * 1.725;
			break;
		case "very active":
			maintenanceCalories = bmr * 1.9;
			break;
		default:
			res.status(400).send("Invalid activity level");
			return;
	}

	let bodyFatPercentage;
	if (gender === "male") {
		bodyFatPercentage = 1.2 * bmi + 0.23 * age - 16.2;
	} else if (gender === "female") {
		bodyFatPercentage = 1.2 * bmi + 0.23 * age - 5.4;
	}

	res.send({ maintenanceCalories, bodyFatPercentage });
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening on port ${port}`));
