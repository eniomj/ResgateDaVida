import os
from dotenv import load_dotenv
import requests
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi


load_dotenv()
uri = os.environ.get("MONGODB_URI")
client = MongoClient(uri, server_api=ServerApi('1'))
db = client["endangered_animals"]
collection = db["artropodes"]

def get_wikidata_id(scientific_name):
    url = f"https://www.wikidata.org/w/api.php"
    params = {
        'action': 'wbsearchentities',
        'search': scientific_name,
        'language': 'pt',
        'format': 'json'
    }
    response = requests.get(url, params=params)
    data = response.json()
    if len(data['search']) > 0:
        return data['search'][0]['id']
    return None

def process_entity(entity):
    results = {}
    
    property_map = {
        'P105': 'taxon rank',
        'P225': 'taxon name',
        'P171': 'parent taxon',
        'P141': 'conservation status'
    }
    if 'claims' in entity:
        claims = entity['claims']

        for prop in property_map:
            if prop in claims:
                claim = claims[prop][0]
                if 'mainsnak' in claim and 'datavalue' in claim['mainsnak']:
                    value = claim['mainsnak']['datavalue']['value']
                    if isinstance(value, dict) and 'id' in value:
                        value = value['id']
                    results[property_map[prop]] = value

    if 'labels' in entity and 'en' in entity['labels']:
        results['label'] = entity['labels']['en']['value']
    if 'descriptions' in entity and 'en' in entity['descriptions']:
        results['description'] = entity['descriptions']['en']['value']
    if 'sitelinks' in entity and 'enwiki' in entity['sitelinks']:
        results['enwiki'] = entity['sitelinks']['enwiki']['title']

    return results

def get_taxon_hierarchy(entity_id):
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json"
    response = requests.get(url)
    if response.status_code != 200:
        return None
    entity_data = response.json()
    
    entity = entity_data['entities'].get(entity_id)
    taxon_info = process_entity(entity)
    
    hierarchy = {
        'kingdom': None,
        'phylum': None,
        'class': None,
        'order': None,
        'family': None,
        'genus': None,
        'species': taxon_info.get('taxon name'),
        'conservation_status': taxon_info.get('conservation status')
    }
    
    if taxon_info.get('conservation status'):
        conservation_status_label = get_conservation_status_label(taxon_info.get('conservation status'))
        hierarchy['conservation_status'] = conservation_status_label if conservation_status_label else 'Desconhecido'
    else:
        hierarchy['conservation_status'] = 'Desconhecido'
    
    current_id = taxon_info.get('parent taxon')
    while current_id:
        parent_url = f"https://www.wikidata.org/wiki/Special:EntityData/{current_id}.json"
        parent_response = requests.get(parent_url)
        if parent_response.status_code != 200:
            break
        parent_data = parent_response.json()
        parent_entity = parent_data['entities'].get(current_id)
        parent_info = process_entity(parent_entity)
        
        taxon_rank = parent_info.get('taxon rank')
        taxon_name = parent_info.get('taxon name')

        if taxon_rank == 'Q36732':  # Reino
            hierarchy['kingdom'] = taxon_name
        elif taxon_rank == 'Q38348':  # Filo
            hierarchy['phylum'] = taxon_name
        elif taxon_rank == 'Q5107' or taxon_rank == 'Q37517':  # Classe 
            hierarchy['class'] = taxon_name
        elif taxon_rank == 'Q36602':  # Ordem
            hierarchy['order'] = taxon_name
        elif taxon_rank == 'Q35409':  # Família
            hierarchy['family'] = taxon_name
        elif taxon_rank == 'Q34740':  # Gênero
            hierarchy['genus'] = taxon_name
        
        current_id = parent_info.get('parent taxon')
    
    return hierarchy

def get_conservation_status_label(status_id):
    if status_id:
        url = f"https://www.wikidata.org/w/api.php"
        params = {
            'action': 'wbgetentities',
            'ids': status_id,
            'format': 'json',
            'props': 'labels',
            'languages': 'pt'
        }
        response = requests.get(url, params=params)
        data = response.json()
        entity = data['entities'].get(status_id)
        if entity and 'labels' in entity and 'pt' in entity['labels']:
            return entity['labels']['pt']['value']
    return None

for animal in collection.find():
    scientific_name = animal["nome_cientifico"]
    common_name = animal.get("nome") 
    
    print(f"Processing {scientific_name}...")
    
    wikidata_id = get_wikidata_id(scientific_name)
    
    if not wikidata_id and common_name:
        print(f"Trying common name {common_name}...")
        wikidata_id = get_wikidata_id(common_name)
    
    if wikidata_id:
        info = get_taxon_hierarchy(wikidata_id)
        print(f"Extracted taxonomy for {scientific_name} ({common_name}): {info}")
        
        if info:
            collection.update_one({"_id": animal["_id"]}, {"$set": info})
            print(f"Updated {scientific_name} ({common_name}) with Wikidata info")
    else:
        print(f"No info found for {scientific_name} ({common_name})")

client.close()
