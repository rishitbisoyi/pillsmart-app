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
inventory_col = db['inventory']
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

    # Create empty inventory
    create_empty_inventory(data['email'])

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

# ---------------- INVENTORY SYSTEM ----------------

def create_empty_inventory(user_email):
    slots = []
    for i in range(1, 9):
        slots.append({
            "slot_number": i,
            "medicine_name": "",
            "total_tablets": 0,
            "tablets_left": 0,
            "schedules": []
        })

    inventory_col.insert_one({
        "user_email": user_email,
        "slots": slots
    })


@app.route("/get_inventory", methods=["GET"])
@token_required
def get_inventory(current_user):

    inventory = inventory_col.find_one(
        {'user_email': current_user['email']},
        {'_id': 0}
    )

    if not inventory:
        create_empty_inventory(current_user['email'])
        inventory = inventory_col.find_one(
            {'user_email': current_user['email']},
            {'_id': 0}
        )

    return jsonify(inventory)


@app.route("/update_slot", methods=["POST"])
@token_required
def update_slot(current_user):

    data = request.json
    slot_number = int(data['slot_number'])

    inventory = inventory_col.find_one({'user_email': current_user['email']})

    if not inventory:
        return jsonify({"error": "Inventory not found"}), 404

    for slot in inventory['slots']:
        if slot['slot_number'] == slot_number:
            slot['medicine_name'] = data.get('medicine_name', "")
            slot['total_tablets'] = data.get('total_tablets', 0)
            slot['tablets_left'] = data.get('total_tablets', 0)
            slot['schedules'] = data.get('schedules', [])

    inventory_col.update_one(
        {'user_email': current_user['email']},
        {'$set': {'slots': inventory['slots']}}
    )

    return jsonify({"success": True})

# ---------------- DISPENSE + LOG ----------------

@app.route("/log_dispense", methods=["POST"])
@token_required
def log_dispense(current_user):

    data = request.json
    slot_number = int(data['slot_number'])
    dosage = int(data['dosage'])

    inventory = inventory_col.find_one({'user_email': current_user['email']})

    for slot in inventory['slots']:
        if slot['slot_number'] == slot_number:

            if slot['tablets_left'] >= dosage:
                slot['tablets_left'] -= dosage

                logs_col.insert_one({
                    "slot_number": slot_number,
                    "medicine_name": slot['medicine_name'],
                    "dosage": dosage,
                    "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "status": "Taken",
                    "user_email": current_user['email']
                })

    inventory_col.update_one(
        {'user_email': current_user['email']},
        {'$set': {'slots': inventory['slots']}}
    )

    return jsonify({"success": True})


@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs(current_user):

    logs = list(
        logs_col.find(
            {'user_email': current_user['email']},
            {'_id': 0}
        ).sort('_id', -1)
    )

    return jsonify(logs)

# ---------------- DEVICE ROUTE ----------------

@app.route("/device_alarms", methods=["GET"])
def device_alarms():

    user_email = request.args.get("email")

    if not user_email:
        return jsonify({"error": "Email required"}), 400

    current_time = datetime.datetime.now().strftime("%H:%M")

    alarms = []

    inventory = inventory_col.find_one({'user_email': user_email})

    if not inventory:
        return jsonify({"alarms": []})

    for slot in inventory['slots']:
        for sched in slot.get('schedules', []):
            if sched['time'] == current_time:
                alarms.append({
                    "slot_number": slot['slot_number'],
                    "dosage": sched['dosage']
                })

    # Sort by slot number for sequential rotation
    alarms.sort(key=lambda x: x["slot_number"])

    return jsonify({"alarms": alarms})

# ---------------- RUN ----------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
