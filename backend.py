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
    users_col = db['users']
    inventory_col = db['inventory']
    logs_col = db['logs']
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

# ---------------- CREATE 8 FIXED SLOTS ----------------

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


@app.route("/reset_password", methods=["POST"])
def reset_password():
    data = request.json
    email = data.get('email')
    new_password = data.get('new_password')

    if not email or not new_password:
        return jsonify({"success": False, "error": "Missing email or password"}), 400

    user = users_col.find_one({'email': email})
    if not user:
        return jsonify({"success": False, "error": "Email not found"}), 404

    hashed_pw = bcrypt.generate_password_hash(new_password).decode('utf-8')
    users_col.update_one({'email': email}, {'$set': {'password': hashed_pw}})

    return jsonify({"success": True, "message": "Password updated successfully"})


@app.route("/change_password", methods=["POST"])
@token_required
def change_password(current_user):
    data = request.json
    curr_pass = data.get('current_password')
    new_pass = data.get('new_password')

    if not curr_pass or not new_pass:
        return jsonify({"success": False, "error": "Missing fields"}), 400

    if not bcrypt.check_password_hash(current_user['password'], curr_pass):
        return jsonify({"success": False, "error": "Incorrect current password"}), 401

    hashed_pw = bcrypt.generate_password_hash(new_pass).decode('utf-8')
    users_col.update_one({'email': current_user['email']}, {'$set': {'password': hashed_pw}})

    return jsonify({"success": True, "message": "Password changed successfully"})

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


@app.route("/update_profile", methods=["POST"])
@token_required
def update_profile(current_user):
    data = request.json
    update_data = {}

    if 'name' in data:
        update_data['name'] = data['name']
    if 'phone' in data:
        update_data['phone'] = data['phone']
    if 'profile_pic' in data:
        update_data['profile_pic'] = data['profile_pic']
    if 'custom_ringtone' in data:
        update_data['custom_ringtone'] = data['custom_ringtone']

    users_col.update_one({'email': current_user['email']}, {'$set': update_data})

    return jsonify({"success": True})

# ---------------- SLOT MANAGEMENT ----------------

@app.route("/get_slots", methods=["GET"])
@token_required
def get_slots(current_user):
    user_inv = inventory_col.find_one({'user_email': current_user['email']})

    if not user_inv:
        slots = create_empty_slots()
        inventory_col.insert_one({
            'user_email': current_user['email'],
            'slots': slots
        })
        return jsonify(slots)

    return jsonify(user_inv['slots'])


@app.route("/update_slot", methods=["POST"])
@token_required
def update_slot(current_user):
    data = request.json
    slot_number = int(data['slot_number'])

    user_inv = inventory_col.find_one({'user_email': current_user['email']})
    slots = user_inv['slots'] if user_inv else create_empty_slots()

    for slot in slots:
        if slot['slot_number'] == slot_number:
            slot['medicine_name'] = data.get('medicine_name', "")
            slot['total_tablets'] = data.get('total_tablets', 0)
            slot['tablets_left'] = data.get('tablets_left', 0)
            slot['schedules'] = data.get('schedules', [])
            break

    inventory_col.update_one(
        {'user_email': current_user['email']},
        {'$set': {'slots': slots}},
        upsert=True
    )

    return jsonify({"success": True})


@app.route("/clear_slot", methods=["POST"])
@token_required
def clear_slot(current_user):
    slot_number = int(request.json['slot_number'])

    user_inv = inventory_col.find_one({'user_email': current_user['email']})
    slots = user_inv['slots']

    for slot in slots:
        if slot['slot_number'] == slot_number:
            slot['medicine_name'] = ""
            slot['total_tablets'] = 0
            slot['tablets_left'] = 0
            slot['schedules'] = []
            break

    inventory_col.update_one(
        {'user_email': current_user['email']},
        {'$set': {'slots': slots}}
    )

    return jsonify({"success": True})

# ---------------- DEVICE ROUTES ----------------

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
        for sched in slot['schedules']:
            unique_times.add(sched['time'])

    return jsonify({"alarms": sorted(list(unique_times))})


@app.route("/device_dispense", methods=["GET"])
def device_dispense():
    user_email = request.args.get("email")
    current_time = request.args.get("time")

    if not user_email or not current_time:
        return jsonify({"error": "Email and time required"}), 400

    user_inv = inventory_col.find_one({'user_email': user_email})
    if not user_inv:
        return jsonify({"slots_to_dispense": []})

    slots = user_inv['slots']
    result = []

    for slot in slots:
        for sched in slot['schedules']:
            if sched['time'] == current_time and slot['tablets_left'] >= sched['dosage']:
                result.append({
                    "slot_number": slot['slot_number'],
                    "dosage": sched['dosage'],
                    "medicine_name": slot['medicine_name']
                })

                slot['tablets_left'] -= sched['dosage']

                logs_col.insert_one({
                    "slot_number": slot['slot_number'],
                    "medicine_name": slot['medicine_name'],
                    "time": datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                    "dosage": sched['dosage'],
                    "status": "Taken",
                    "user_email": user_email
                })

    inventory_col.update_one(
        {'user_email': user_email},
        {'$set': {'slots': slots}}
    )

    return jsonify({"slots_to_dispense": result})

# ---------------- LOGS ----------------

@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs_route(current_user):
    logs = []

    for log in logs_col.find({'user_email': current_user['email']}).sort('_id', -1):
        log['_id'] = str(log['_id'])
        logs.append(log)

    return jsonify(logs)

# ---------------- RUN SERVER ----------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
