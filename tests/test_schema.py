from google import genai

client = genai.Client(api_key="")

print("Available models for your API key:")
for model in client.models.list():
    if "flash" in model.name.lower():
        print(f" -> {model.name}")