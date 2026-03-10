import os
from dotenv import load_dotenv
from google import genai

def test_connection():
    env_path = os.path.join(os.path.dirname(__file__), '../../.env')
    load_dotenv(dotenv_path=env_path)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Помилка: Ключ GEMINI_API_KEY не знайдено у файлі .env")
        return

    client = genai.Client(api_key=api_key)
    
    print("Відправка тестового запиту до Gemini...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Напиши одне коротке речення про важливість макроекономічних показників."
        )
        print("\nВідповідь від Gemini:")
        print("-" * 30)
        print(response.text.strip())
        print("-" * 30)
    except Exception as e:
        print(f"Помилка підключення: {e}")

if __name__ == "__main__":
    test_connection()