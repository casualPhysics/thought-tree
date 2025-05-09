# Question Resolver
A tool that I built to help me manage uncertainties and experiments. I'm trying this out as an alternative to standard goal and task settings to help 
me deal with uncertainties better. 

I wrote about why I designed this approach in [How do I achieve what I want](https://substack.com/home/post/p-162918993). 

![Question Resolver Screenshot](images/example.png)

A web application for managing nested questions, experiments, and their resolutions. Built with Flask. 

## Features

- Create and manage nested questions
- Track to-resolve items for each question
- Set time frames and track remaining time
- Add and update answers
- Modern, responsive UI with dark mode

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd question-resolver
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Technologies Used

- Backend: Flask, SQLAlchemy
- Frontend: HTML, JavaScript, TailwindCSS
- Database: SQLite

## Project Structure

- `app.py`: Main Flask application
- `static/`: Frontend assets
  - `app.js`: Frontend JavaScript
  - `styles.css`: Custom styles
  - `index.html`: Main HTML template
- `instance/`: Database files (not tracked in git)
- `requirements.txt`: Python dependencies

## Usage

1. Add a root question using the form at the top of the page
2. Click "Add Child" on any question to create a sub-question
3. Use the "Edit" button to modify questions or add time frames
4. Add items to resolve under each question
5. Add or update answers for each question
6. Check off completed items in the "To Resolve" section

## Structure

The application uses:
- Flask backend with SQLAlchemy for database management
- SQLite database for data storage
- Modern frontend with Tailwind CSS
- Vanilla JavaScript for interactivity

## License

MIT License 