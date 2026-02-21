import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
from flask_bcrypt import Bcrypt
import jwt
from functools import wraps

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI")
SECRET_KEY = os.environ.get("SECRET_KEY", "my_secret_key_change_this")

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

CORS(app)
bcrypt = Bcrypt(app)

# ---------------- DATABASE CONNECTION ----------------

try:
    client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    db = client['medicine_dispenser_db']
    logs_col = db['logs']
    users_col = db['users']
    inventory_col = db['inventory']
    print("✓ Successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    client = None

# ---------------- JWT AUTH DECORATOR ----------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            else:
                token = auth_header

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_col.find_one({'email': data['email']})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401

        return f(current_user, *args, **kwargs)

    return decorated

# ---------------- TIME CONVERSION ----------------

def convert_to_24h(time_str):
    try:
        return datetime.datetime.strptime(time_str.strip(), "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return time_str

def convert_to_12h(time_24h):
    try:
        return datetime.datetime.strptime(time_24h.strip(), "%H:%M").strftime("%I:%M %p")
    except:
        return time_24h

# ---------------- BASIC ROUTE ----------------

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# ---------------- AUTH ROUTES ----------------

@app.route("/register", methods=["POST"])
def register_user():
    data = request.json

    if users_col.find_one({'email': data['email']}):
        return jsonify({"success": False, "error": "Email already exists"}), 400

    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    users_col.insert_one({
        'name': data['name'],
        'email': data['email'],
        'phone': data.get('phone', ''),
        'password': hashed_pw,
        'profile_pic': '',
        'custom_ringtone': ''
    })

    return jsonify({"success": True, "message": "Registered successfully"})

@app.route("/login", methods=["POST"])
def login_user():
    data = request.json
    user = users_col.find_one({'email': data['email']})

    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    if not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({"success": False, "error": "Incorrect password"}), 401

    token = jwt.encode(
        {
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )

    return jsonify({
        "success": True,
        "token": token,
        "email": user['email'],
        "name": user['name']
    })

# ---------------- PROFILE ----------------

@app.route("/get_profile", methods=["GET"])
@token_required
def get_profile(current_user):
    return jsonify({
        "name": current_user.get("name"),
        "email": current_user.get("email"),
        "phone": current_user.get("phone", ""),
        "profile_pic": current_user.get("profile_pic", ""),
        "custom_ringtone": current_user.get("custom_ringtone", "")
    })

# ---------------- INVENTORY (NEW SLOT SYSTEM) ----------------

def create_empty_slots():
    return [
        {
            "slot_number": i,
            "medicine_name": "",
            "total_tablets": 0,
            "tablets_left": 0,
            "schedules": []
        }
        for i in range(1, 9)
    ]

@app.route("/get_inventory", methods=["GET"])
@token_required
def get_inventory(current_user):
    user_inv = inventory_col.find_one({'user_email': current_user['email']})

    if not user_inv:
        slots = create_empty_slots()
        inventory_col.insert_one({
            "user_email": current_user['email'],
            "slots": slots
        })
        return jsonify(slots)

    return jsonify(user_inv['slots'])

@app.route("/update_slot", methods=["POST"])
@token_required
def update_slot(current_user):
    data = request.json
    slot_number = int(data['slot_number'])

    user_inv = inventory_col.find_one({'user_email': current_user['email']})

    if not user_inv:
        slots = create_empty_slots()
    else:
        slots = user_inv['slots']

    slots[slot_number - 1] = data

    inventory_col.update_one(
        {'user_email': current_user['email']},
        {'$set': {'slots': slots}},
        upsert=True
    )

    return jsonify({"success": True})

# ---------------- LOGS ----------------

@app.route("/log_dispense", methods=["POST"])
@token_required
def log_dispense_route(current_user):
    data = request.json

    logs_col.insert_one({
        'slot_number': data['slot_number'],
        'medicine_name': data['medicine_name'],
        'dosage': data['dosage'],
        'time': datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        'status': data['status'],
        'user_email': current_user['email']
    })

    return jsonify({"success": True})

@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs_route(current_user):
    logs = []

    for log in logs_col.find({'user_email': current_user['email']}).sort('_id', -1):
        log['_id'] = str(log['_id'])
        logs.append(log)

    return jsonify(logs)

# ---------------- DEVICE ROUTE (UPDATED) ----------------

@app.route("/device_alarms", methods=["GET"])
def device_alarms():
    user_email = request.args.get("email")

    if not user_email:
        return jsonify({"error": "Email required"}), 400

    user_inv = inventory_col.find_one({'user_email': user_email})

    if not user_inv:
        return jsonify({"alarms": []})

    unique_times = set()

    for slot in user_inv['slots']:
        for schedule in slot.get("schedules", []):
            unique_times.add(schedule["time"])

    sorted_times = sorted(list(unique_times))

    return jsonify({"alarms": sorted_times})

# ---------------- RUN SERVER ----------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
