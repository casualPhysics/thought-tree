from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Configure SQLite database with more robust settings
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///questions.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

db = SQLAlchemy(app)

# Ensure the database file exists
def init_db():
    with app.app_context():
        if not os.path.exists('questions.db'):
            db.create_all()
            print("Database created successfully")
        else:
            print("Database already exists")

# Models
class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=True)
    time_frame = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), default='pending')  # pending, done, in_progress
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    children = db.relationship('Question', backref=db.backref('parent', remote_side=[id]), cascade='all, delete-orphan')
    to_resolve = db.relationship('ToResolve', backref='question', lazy=True, cascade='all, delete-orphan')
    current_answer = db.relationship('CurrentAnswer', backref='question', uselist=False, cascade='all, delete-orphan')

class ToResolve(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CurrentAnswer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Routes
@app.route('/api/questions', methods=['GET'])
def get_questions():
    root_questions = Question.query.filter_by(parent_id=None).all()
    return jsonify([{
        'id': q.id,
        'text': q.text,
        'time_frame': q.time_frame,
        'status': q.status,
        'children': get_question_tree(q)
    } for q in root_questions])

def get_question_tree(question):
    return [{
        'id': child.id,
        'text': child.text,
        'time_frame': child.time_frame,
        'status': child.status,
        'to_resolve': [{'id': tr.id, 'text': tr.text, 'completed': tr.completed} 
                      for tr in child.to_resolve],
        'current_answer': child.current_answer.text if child.current_answer else None,
        'children': get_question_tree(child)
    } for child in question.children]

@app.route('/api/questions', methods=['POST'])
def create_question():
    data = request.json
    question = Question(
        text=data['text'],
        parent_id=data.get('parent_id'),
        time_frame=data.get('time_frame'),
        status=data.get('status', 'pending')
    )
    db.session.add(question)
    db.session.commit()
    return jsonify({'id': question.id, 'text': question.text})

@app.route('/api/questions/<int:question_id>', methods=['PUT'])
def update_question(question_id):
    question = Question.query.get_or_404(question_id)
    data = request.json
    question.text = data.get('text', question.text)
    question.time_frame = data.get('time_frame', question.time_frame)
    question.status = data.get('status', question.status)
    db.session.commit()
    return jsonify({'id': question.id, 'text': question.text})

@app.route('/api/questions/<int:question_id>', methods=['DELETE'])
def delete_question(question_id):
    question = Question.query.get_or_404(question_id)
    db.session.delete(question)
    db.session.commit()
    return jsonify({'message': 'Question deleted successfully'})

@app.route('/api/questions/<int:question_id>/to-resolve', methods=['POST'])
def add_to_resolve(question_id):
    question = Question.query.get_or_404(question_id)
    data = request.json
    to_resolve = ToResolve(
        text=data['text'],
        question_id=question_id
    )
    db.session.add(to_resolve)
    db.session.commit()
    return jsonify({'id': to_resolve.id, 'text': to_resolve.text})

@app.route('/api/questions/<int:question_id>/answer', methods=['POST'])
def add_answer(question_id):
    question = Question.query.get_or_404(question_id)
    data = request.json
    
    if question.current_answer:
        question.current_answer.text = data['text']
    else:
        answer = CurrentAnswer(
            text=data['text'],
            question_id=question_id
        )
        db.session.add(answer)
    
    db.session.commit()
    return jsonify({'text': data['text']})

@app.route('/api/questions/<int:question_id>/to-resolve/<int:to_resolve_id>', methods=['PUT'])
def update_to_resolve(question_id, to_resolve_id):
    to_resolve = ToResolve.query.get_or_404(to_resolve_id)
    data = request.json
    
    # Update both text and completed status if provided
    if 'text' in data:
        to_resolve.text = data['text']
    if 'completed' in data:
        to_resolve.completed = data['completed']
    
    db.session.commit()
    return jsonify({
        'id': to_resolve.id,
        'text': to_resolve.text,
        'completed': to_resolve.completed
    })

@app.route('/api/questions/<int:question_id>/to-resolve/<int:to_resolve_id>', methods=['DELETE'])
def delete_to_resolve(question_id, to_resolve_id):
    to_resolve = ToResolve.query.get_or_404(to_resolve_id)
    db.session.delete(to_resolve)
    db.session.commit()
    return jsonify({'message': 'To-resolve item deleted successfully'})

def format_question_as_markdown(question, level=0):
    indent = '\t' * level
    markdown = []
    
    # Add question text with time frame if present
    question_text = f"**{question.text}**"
    if question.time_frame:
        question_text += f" ({question.time_frame})"
    if question.status == 'done':
        question_text += " (Done)"
    markdown.append(f"{indent}- {question_text}")
    
    # Add to-resolve items if any
    if question.to_resolve:
        markdown.append(f"{indent}\t- TO RESOLVE:")
        for item in question.to_resolve:
            status = "[x]" if item.completed else "[]"
            markdown.append(f"{indent}\t\t- {item.text} {status}")
    
    # Add current answer if present
    if question.current_answer:
        markdown.append(f"{indent}\t- CURRENT ANSWER")
        markdown.append(f"{indent}\t\t- {question.current_answer.text}")
    
    # Add children recursively
    for child in question.children:
        markdown.extend(format_question_as_markdown(child, level + 1))
    
    return markdown

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    root_questions = Question.query.filter_by(parent_id=None).all()
    markdown_lines = []
    
    for question in root_questions:
        markdown_lines.extend(format_question_as_markdown(question))
    
    markdown_text = '\n'.join(markdown_lines)
    return jsonify({'markdown': markdown_text})

if __name__ == '__main__':
    init_db()
    app.run(debug=True, use_reloader=False) 