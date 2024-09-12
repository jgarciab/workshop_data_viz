##Test locally before converting
#panel serve bokeh_app.py 

##Convert to WASM app
panel convert bokeh_app.py --to pyodide-worker --out ./app --pwa 
#Launch server to test locally
#python3 -m http.server