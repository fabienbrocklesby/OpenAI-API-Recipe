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

app.get("/recipe", function (req, res) {
	res.sendFile(path.join(__dirname, "public", "recipe.html"));
});

app.get("/healthmetrics", function (req, res) {
	res.sendFile(path.join(__dirname, "public", "healthmetrics.html"));
});

app.get("/calculatecalories", function (req, res) {
	res.sendFile(path.join(__dirname, "public", "calculatecalories.html"));
});

async function getRecipe(
	recipeName,
	calories,
	servingSize,
	budget,
	bodybuilderStyle,
	bodybuilderOption
) {
	console.log(recipeName, calories, servingSize, budget, bodybuilderStyle);
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
	if (bodybuilderStyle) {
		prompt += ` that is suitable for a bodybuilder's diet`;
		if (bodybuilderOption) {
			prompt += ` with a focus on ${bodybuilderOption}`;
		}
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
	const {
		recipe,
		calories,
		servingSize,
		budget,
		bodybuilderStyle,
		bodybuilderOption,
	} = req.body;
	console.log(req.body);

	try {
		const recipeData = await getRecipe(
			recipe,
			calories,
			servingSize,
			budget,
			bodybuilderStyle,
			bodybuilderOption
		);
		res.send(recipeData);
	} catch (error) {
		console.error(error);
		res.status(500).send("Internal Server Error");
	}
});

app.post("/calculateHealthMetrics", async (req, res) => {
	const { age, weight, height, gender, activityLevel } = req.body;

	let bmr;
	if (gender === "male") {
		bmr = 10 * weight + 6.25 * height - 5 * age + 5;
	} else if (gender === "female") {
		bmr = 10 * weight + 6.25 * height - 5 * age - 161;
	} else {
		res.status(400).send("Invalid gender");
		return;
	}

	console.log(bmr);

	const heightInMeters = height / 100;
	const bmi = weight / (heightInMeters * heightInMeters);

	let maintenanceCalories;
	let activityAdjustment;

	switch (activityLevel) {
		case "sedentary":
			maintenanceCalories = bmr * 1.2;
			activityAdjustment = 0;
			break;
		case "light":
			maintenanceCalories = bmr * 1.375;
			activityAdjustment = 0.6;
			break;
		case "moderate":
			maintenanceCalories = bmr * 1.55;
			activityAdjustment = 1.3;
			break;
		case "active":
			maintenanceCalories = bmr * 1.725;
			activityAdjustment = 1.8;
			break;
		case "very active":
			maintenanceCalories = bmr * 1.9;
			activityAdjustment = 2.3;
			break;
		default:
			res.status(400).send("Invalid activity level");
			return;
	}

	if (gender === "male") {
		bodyFatPercentage = 1.2 * bmi + 0.23 * age - 16.2 - activityAdjustment;
	} else if (gender === "female") {
		bodyFatPercentage = 1.2 * bmi + 0.23 * age - 5.4 - activityAdjustment;
	}

	res.send({ maintenanceCalories, bodyFatPercentage, bmr });
});

app.post("/calculaterequiredcalories", async (req, res) => {
	let {
		weightChange,
		timeFrame,
		maintenanceCalories,
		gender,
		useDetailedFactors,
		age,
		bmr,
		weight,
		height,
	} = req.body;
	console.log(req.body);

	weightChange = parseInt(weightChange);
	timeFrame = parseInt(timeFrame);
	maintenanceCalories = parseInt(maintenanceCalories);

	const totalCaloricChange = weightChange * 3500;

	let dailyCaloricChange = totalCaloricChange / timeFrame;

	if (gender === "female") {
		dailyCaloricChange *= 0.85;
	}

	let requiredDailyCalories = maintenanceCalories + dailyCaloricChange;

	// if (useAI) {
	// 	requiredDailyCalories = await adjustCaloriesWithAI(
	// 		requiredDailyCalories,
	// 		age,
	// 		metabolismRate,
	// 		gender,
	// 		weight,
	// 		height
	// 	);
	// }

	if (useDetailedFactors) {
		requiredDailyCalories = calculateCaloriesWithDetailedFactors(
			requiredDailyCalories,
			bmr,
			age,
			weight,
			height
		);
	}

	res.json({ requiredDailyCalories });
});

function calculateCaloriesWithDetailedFactors(
	requiredDailyCalories,
	bmr,
	age,
	weight,
	height
) {
	let bmrFactor;
	if (bmr < 1600) {
		bmrFactor = 1.05; // adjust these values as needed
	} else if (bmr >= 1600 && bmr < 2000) {
		bmrFactor = 1.0;
	} else {
		bmrFactor = 0.95; // adjust these values as needed
	}

	let ageFactor;
	if (age < 18) {
		ageFactor = 1.1; // was 1.2
	} else if (age >= 18 && age <= 35) {
		ageFactor = 1.0;
	} else if (age > 35 && age <= 55) {
		ageFactor = 0.95; // was 0.9
	} else {
		ageFactor = 0.9; // was 0.8
	}

	// Calculate BMI
	let heightInMeters = height / 100;
	let bmi = weight / (heightInMeters * heightInMeters);

	let bmiFactor;
	if (bmi < 18.5) {
		bmiFactor = 1.1; // was 1.2
	} else if (bmi >= 18.5 && bmi < 25) {
		bmiFactor = 1.0;
	} else if (bmi >= 25 && bmi < 30) {
		bmiFactor = 0.95; // was 0.9
	} else {
		bmiFactor = 0.9; // was 0.8
	}

	return requiredDailyCalories * bmrFactor * ageFactor * bmiFactor;
}
// async function adjustCaloriesWithAI(
// 	calories,
// 	age,
// 	metabolismRate,
// 	sex,
// 	weight,
// 	height
// ) {
// 	const prompt = `Given a person with the following information:
//           - Age: ${age} years old
//           - Sex: ${sex}
//           - Metabolism rate: ${metabolismRate}
//           - Weight: ${weight} kg
//           - Height: ${height} cm
//           - Original calorie intake suggestion: ${calories} calories

//   Considering these factors, what is the most precise daily calorie intake this person should consume?

//   Please respond with a JSON object with a single property "caloriesRequired" containing the calculated value.

//   **Note:**
//   * A faster metabolism might require significantly more calories, while a slower metabolism might require significantly fewer.
//   * Sex, weight, and height play a major role in basal metabolic rate (BMR) which influences calorie needs.

//   Please make a substantial adjustment to the original calorie intake suggestion based on these factors.
//   `;

// 	const messages = [
// 		{
// 			role: "system",
// 			content:
// 				"You are a registered dietitian with access to extensive dietary data. Please provide a precise numerical answer based on the provided information.",
// 		},
// 		{
// 			role: "user",
// 			content: prompt,
// 		},
// 	];

// 	const response = await openai.chat.completions.create({
// 		model: "gpt-3.5-turbo",
// 		response_format: { type: "json_object" },
// 		messages: messages,
// 		max_tokens: 1500,
// 		temperature: 0.1,
// 	});

// 	const adjustedCalories = JSON.parse(
// 		response.choices[0].message.content
// 	).caloriesRequired;

// 	return adjustedCalories;
// }

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening on port ${port}`));
