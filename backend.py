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
CORS(app)
bcrypt = Bcrypt(app)

# ---------------- DATABASE CONNECTION ----------------

client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
db = client['medicine_dispenser_db']

users_col = db['users']
slots_col = db['slots']
logs_col = db['logs']

print("✓ MongoDB Connected")

# ---------------- JWT DECORATOR ----------------

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
            return jsonify({'message': 'Token missing'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_col.find_one({'email': data['email']})
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
        except:
            return jsonify({'message': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated

# ---------------- BASIC ROUTE ----------------

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# ---------------- AUTH ----------------

@app.route("/register", methods=["POST"])
def register_user():
    data = request.json

    if users_col.find_one({'email': data['email']}):
        return jsonify({"success": False, "error": "Email exists"}), 400

    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    users_col.insert_one({
        'name': data['name'],
        'email': data['email'],
        'password': hashed_pw,
        'profile_pic': '',
        'custom_ringtone': ''
    })

    return jsonify({"success": True})


@app.route("/login", methods=["POST"])
def login_user():
    data = request.json
    user = users_col.find_one({'email': data['email']})

    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    if not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({"success": False, "error": "Incorrect password"}), 401

    token = jwt.encode(
        {'email': user['email'],
         'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)},
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
        "profile_pic": current_user.get("profile_pic", ""),
        "custom_ringtone": current_user.get("custom_ringtone", "")
    })


@app.route("/update_profile", methods=["POST"])
@token_required
def update_profile(current_user):
    data = request.json
    update_data = {}

    if 'name' in data:
        update_data['name'] = data['name']
    if 'profile_pic' in data:
        update_data['profile_pic'] = data['profile_pic']
    if 'custom_ringtone' in data:
        update_data['custom_ringtone'] = data['custom_ringtone']

    users_col.update_one({'email': current_user['email']}, {'$set': update_data})
    return jsonify({"success": True})

# ---------------- SLOT SYSTEM ----------------

def create_empty_slots(user_email):
    slots = []
    for i in range(1, 9):
        slots.append({
            "slot": i,
            "medicine_name": "",
            "total_tablets": 0,
            "tablets_left": 0,
            "schedule": [],
            "user_email": user_email
        })
    slots_col.insert_many(slots)


@app.route("/get_slots", methods=["GET"])
@token_required
def get_slots(current_user):

    user_slots = list(slots_col.find({'user_email': current_user['email']}, {'_id': 0}))

    if not user_slots:
        create_empty_slots(current_user['email'])
        user_slots = list(slots_col.find({'user_email': current_user['email']}, {'_id': 0}))

    return jsonify(user_slots)


@app.route("/update_slot", methods=["POST"])
@token_required
def update_slot(current_user):
    data = request.json

    slot_number = int(data['slot'])

    slots_col.update_one(
        {'slot': slot_number, 'user_email': current_user['email']},
        {'$set': {
            'medicine_name': data.get('medicine_name', ''),
            'total_tablets': data.get('total_tablets', 0),
            'tablets_left': data.get('total_tablets', 0),
            'schedule': data.get('schedule', [])
        }}
    )

    return jsonify({"success": True})

# ---------------- DISPENSE LOGIC ----------------

@app.route("/log_dispense", methods=["POST"])
@token_required
def log_dispense(current_user):
    data = request.json

    slot_number = int(data['slot'])
    dosage = int(data['dosage'])

    slot = slots_col.find_one({'slot': slot_number, 'user_email': current_user['email']})

    if slot and slot['tablets_left'] >= dosage:
        new_count = slot['tablets_left'] - dosage

        slots_col.update_one(
            {'slot': slot_number, 'user_email': current_user['email']},
            {'$set': {'tablets_left': new_count}}
        )

        logs_col.insert_one({
            'slot': slot_number,
            'dosage': dosage,
            'time': datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            'user_email': current_user['email']
        })

    return jsonify({"success": True})


@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs(current_user):
    logs = list(logs_col.find({'user_email': current_user['email']}, {'_id': 0}).sort('_id', -1))
    return jsonify(logs)

# ---------------- DEVICE ROUTE ----------------

@app.route("/device_alarms", methods=["GET"])
def device_alarms():
    user_email = request.args.get("email")

    if not user_email:
        return jsonify({"error": "Email required"}), 400

    current_time = datetime.datetime.now().strftime("%H:%M")

    alarms = []

    user_slots = slots_col.find({'user_email': user_email})

    for slot in user_slots:
        for sched in slot.get('schedule', []):
            if sched['time'] == current_time:
                alarms.append({
                    "slot": slot['slot'],
                    "dosage": sched['dosage']
                })

    return jsonify({"alarms": alarms})

# ---------------- RUN ----------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
