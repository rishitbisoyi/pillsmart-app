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

try:
    client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
    db = client['medicine_dispenser_db']
    medicines_col = db['schedules']
    logs_col = db['logs']
    users_col = db['users']
    inventory_col = db['inventory'] 
    print("✓ Successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    client = None

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
        if not token: return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_col.find_one({'email': data['email']})
            if not current_user: return jsonify({'message': 'User not found!'}), 401
        except Exception as e: return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def convert_to_24h(time_str):
    try: return datetime.datetime.strptime(time_str.strip(), "%I:%M %p").strftime("%H:%M")
    except ValueError: return time_str

def convert_to_12h(time_24h):
    try: return datetime.datetime.strptime(time_24h.strip(), "%H:%M").strftime("%I:%M %p")
    except: return time_24h

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    if users_col.find_one({'email': data['email']}):
        return jsonify({"success": False, "error": "Email already exists"}), 400
    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    users_col.insert_one({
        'name': data['name'], 'email': data['email'], 'phone': data.get('phone', ''),
        'password': hashed_pw, 'profile_pic': '', 'custom_ringtone': ''
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

    token = jwt.encode({'email': user['email'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], algorithm="HS256")
    return jsonify({"success": True, "token": token, "email": user['email'], "name": user['name']})

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
    
    if 'name' in data: update_data['name'] = data['name']
    if 'phone' in data: update_data['phone'] = data['phone']
    if 'profile_pic' in data: update_data['profile_pic'] = data['profile_pic']
    if 'custom_ringtone' in data: update_data['custom_ringtone'] = data['custom_ringtone']

    users_col.update_one({'email': current_user['email']}, {'$set': update_data})
    return jsonify({"success": True, "name": data.get('name', current_user['name'])})

@app.route("/get_all_medicines", methods=["GET"])
@token_required
def get_medicines(current_user):
    medicines = []
    for med in medicines_col.find({'user_email': current_user['email']}):
        med['time'] = convert_to_12h(med['time'])
        med['_id'] = str(med['_id'])
        medicines.append(med)
    return jsonify(medicines)

@app.route("/add_medicine", methods=["POST"])
@token_required
def add_medicine_route(current_user):
    data = request.json
    time_24h = convert_to_24h(data['time'])
    if medicines_col.find_one({'name': data['name'], 'user_email': current_user['email']}): return jsonify({"success": False, "error": "Exists"})
    medicines_col.insert_one({'name': data['name'], 'dosage': data['dosage'], 'time': time_24h, 'status': 'Pending', 'user_email': current_user['email']})
    return jsonify({"success": True})

@app.route("/delete_medicine", methods=["POST"])
@token_required
def delete_medicine_route(current_user):
    medicines_col.delete_one({'name': request.json['name'], 'user_email': current_user['email']})
    return jsonify({"success": True})

@app.route("/log_dispense", methods=["POST"])
@token_required
def log_dispense_route(current_user):
    data = request.json
    medicines_col.update_one({'name': data['name'], 'user_email': current_user['email']}, {'$set': {'status': data['status']}})
    logs_col.insert_one({'medicine': data['name'], 'time': datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p"), 'status': data['status'], 'user_email': current_user['email']})
    return jsonify({"success": True})

@app.route("/get_logs", methods=["GET"])
@token_required
def get_logs_route(current_user):
    logs = []
    for log in logs_col.find({'user_email': current_user['email']}).sort('_id', -1):
        log['_id'] = str(log['_id'])
        logs.append(log)
    return jsonify(logs)

@app.route("/get_inventory", methods=["GET"])
@token_required
def get_inventory(current_user):
    user_inv = inventory_col.find_one({'user_email': current_user['email']})
    return jsonify(user_inv['slots']) if user_inv else jsonify([{"slot": i, "name": "Empty", "dosePerDay": "-", "tabletsLeft": "-", "refillDate": "-", "food": "-"} for i in range(1, 9)])

@app.route("/update_inventory", methods=["POST"])
@token_required
def update_inventory(current_user):
    data, slot_num = request.json, int(request.json['slot'])
    user_inv = inventory_col.find_one({'user_email': current_user['email']})
    if not user_inv:
        slots = [{"slot": i, "name": "Empty", "dosePerDay": "-", "tabletsLeft": "-", "refillDate": "-", "food": "-"} for i in range(1, 9)]
        slots[slot_num - 1] = data
        inventory_col.insert_one({'user_email': current_user['email'], 'slots': slots})
    else:
        current_slots = user_inv['slots']
        for i, s in enumerate(current_slots):
            if s['slot'] == slot_num: current_slots[i] = data; break
        inventory_col.update_one({'user_email': current_user['email']}, {'$set': {'slots': current_slots}})
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True, port=5000)