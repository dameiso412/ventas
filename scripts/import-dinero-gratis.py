#!/usr/bin/env python3
"""
Script para importar leads calificados del CSV de encuestas a la sección "Dinero Gratis".
Criterios:
- Tienen dinero/crédito (situación financiera = "Sí - ACTUALMENTE tengo el dinero...")
- O inversión >= 500 USD (Entre 500-1000 o Entre 1000-1800)
- NO tienen cita agendada en la DB (cruce por correo o teléfono)
"""
import csv
import re
import sys
import os
from datetime import datetime
import mysql.connector
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv('/home/ubuntu/sacamedi-crm/.env')

DATABASE_URL = os.environ.get('DATABASE_URL', '')

def parse_db_url(url):
    """Parsear DATABASE_URL de formato mysql://user:pass@host:port/db"""
    # Formato: mysql://user:pass@host:port/db o mysql2://...
    url = url.replace('mysql2://', 'mysql://')
    match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', url)
    if match:
        return {
            'user': match.group(1),
            'password': match.group(2),
            'host': match.group(3),
            'port': int(match.group(4)),
            'database': match.group(5).split('?')[0],
        }
    return None

def normalize_phone(phone):
    """Normalizar teléfono para comparación"""
    if not phone:
        return ''
    return re.sub(r'[\s\-\(\)\+]', '', phone.strip())

def normalize_email(email):
    """Normalizar correo para comparación"""
    return email.strip().lower() if email else ''

def parse_csv_date(date_str):
    """Parsear fecha del CSV: 'Mar 5th 2026, 5:57 am' → datetime"""
    if not date_str:
        return datetime.now()
    try:
        clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
        return datetime.strptime(clean, '%b %d %Y, %I:%M %p')
    except:
        try:
            clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
            return datetime.strptime(clean.split(',')[0].strip(), '%b %d %Y')
        except:
            return datetime.now()

def map_origen(row):
    """Mapear origen desde UTM source"""
    src = (row.get('UTM Source', '') or row.get('Fuente UTM', '') or '').lower()
    if any(x in src for x in ['fb', 'facebook', 'ig', 'instagram', 'google']):
        return 'ADS'
    fuente = (row.get('Fuente', '') or '').lower()
    if 'direct' in fuente:
        return 'ORGANICO'
    return 'ADS'

def main():
    db_config = parse_db_url(DATABASE_URL)
    if not db_config:
        print(f"ERROR: No se pudo parsear DATABASE_URL: {DATABASE_URL[:50]}...")
        sys.exit(1)

    # Conectar a la DB
    print(f"Conectando a {db_config['host']}:{db_config['port']}/{db_config['database']}...")
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # 1. Obtener todos los leads de tipo AGENDA de la DB
    cursor.execute('SELECT correo, telefono, nombre FROM leads WHERE categoria = "AGENDA"')
    agendas = cursor.fetchall()

    correo_set = set()
    telefono_set = set()
    for a in agendas:
        if a['correo']:
            correo_set.add(normalize_email(a['correo']))
        if a['telefono']:
            telefono_set.add(normalize_phone(a['telefono']))

    print(f"Agendas en DB: {len(agendas)} ({len(correo_set)} correos, {len(telefono_set)} teléfonos)")

    # 2. Leer el CSV
    with open('/home/ubuntu/upload/SurveySubmission(2).csv', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"Total registros en CSV: {len(rows)}")

    INV_FIELD = '¿Cuál es tu capacidad actual de inversión en tu negocio?'
    SIT_FIELD = '¿Cuál de estas describe tu situación financiera? * *'

    # 3. Filtrar calificados
    calificados = []
    for r in rows:
        inv = (r.get(INV_FIELD) or '').strip()
        sit = (r.get(SIT_FIELD) or '').strip()
        if 'Sí - ACTUALMENTE tengo el dinero' in sit:
            calificados.append(r)
        elif 'Entre 500' in inv or 'Entre 1.000' in inv:
            calificados.append(r)

    print(f"Calificados por inversión: {len(calificados)}")

    # 4. Excluir los que ya tienen agenda
    sin_agenda = []
    con_agenda = []
    for r in calificados:
        correo = normalize_email(r.get('Mi mejor correo electronico es..', '') or '')
        tel = normalize_phone(r.get('Mi Numero de WhastsApp es', '') or '')
        if correo in correo_set or (tel and tel in telefono_set):
            con_agenda.append(r)
        else:
            sin_agenda.append(r)

    print(f"\nCalificados que YA tienen agenda (excluidos): {len(con_agenda)}")
    for r in con_agenda:
        print(f"  - {r['Mi Nombre Completo es..'].strip()} | {r['Mi mejor correo electronico es..'].strip()}")

    print(f"\nA importar en Dinero Gratis: {len(sin_agenda)}")

    # 5. Insertar los leads sin agenda
    insertados = 0
    duplicados = 0

    for r in sin_agenda:
        nombre = (r.get('Mi Nombre Completo es..') or '').strip()
        correo = (r.get('Mi mejor correo electronico es..') or '').strip()
        telefono = (r.get('Mi Numero de WhastsApp es') or '').strip()
        fecha_envio = parse_csv_date(r.get('Fecha de envío', ''))
        origen = map_origen(r)

        inv = (r.get(INV_FIELD) or '').strip()
        sit = (r.get(SIT_FIELD) or '').strip()

        # Construir nota con la info de inversión
        if 'Sí - ACTUALMENTE tengo el dinero' in sit:
            nivel_inversion = 'Tiene crédito/dinero disponible'
        elif 'Entre 1.000' in inv:
            nivel_inversion = 'Entre 1.000-1.800 USD'
        elif 'Entre 500' in inv:
            nivel_inversion = 'Entre 500-1.000 USD'
        else:
            nivel_inversion = inv

        notas = f"Encuesta: {nivel_inversion}"
        if len(notas) > 500:
            notas = notas[:500]

        # Verificar si ya existe como LEAD (evitar duplicados)
        cursor.execute(
            'SELECT id FROM leads WHERE (correo = %s OR telefono = %s) AND categoria = "LEAD"',
            (correo or None, telefono or None)
        )
        existing = cursor.fetchall()

        if existing:
            print(f"  [SKIP] Ya existe como LEAD: {nombre} | {correo}")
            duplicados += 1
            continue

        # Insertar como LEAD (Dinero Gratis)
        cursor.execute(
            """INSERT INTO leads (
                nombre, correo, telefono, fecha, origen, categoria, estadoLead,
                notas, createdAt, updatedAt
            ) VALUES (%s, %s, %s, %s, %s, 'LEAD', 'NUEVO', %s, %s, %s)""",
            (
                nombre or 'Sin nombre',
                correo or None,
                telefono or None,
                fecha_envio,
                origen,
                notas,
                fecha_envio,
                fecha_envio,
            )
        )
        insertados += 1
        print(f"  [OK] {nombre} | {correo} | {nivel_inversion}")

    conn.commit()
    cursor.close()
    conn.close()

    print(f"\n✅ Importación completada:")
    print(f"   Insertados: {insertados}")
    print(f"   Duplicados omitidos: {duplicados}")
    print(f"   Total calificados sin agenda: {len(sin_agenda)}")

if __name__ == '__main__':
    main()
