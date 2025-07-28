# PowerShell script to rename and copy images
Set-Location "public\images"

# Copy existing images to match our naming convention
Copy-Item "Pasta.jpg" -Destination "vegetarian-pasta.jpg" -Force
Copy-Item "Salad.jpg" -Destination "seafood-paella.jpg" -Force
Copy-Item "Fruit Salad.jpg" -Destination "apple-pie.jpg" -Force
Copy-Item "Brocolli.jpg" -Destination "stuffed-mushrooms.jpg" -Force
Copy-Item "Lemon.jpg" -Destination "sparkling-water.jpg" -Force
Copy-Item "Pizza.jpg" -Destination "tiramisu.jpg" -Force
Copy-Item "Naan.jpg" -Destination "cheesecake.jpg" -Force
Copy-Item "Salad.jpg" -Destination "ice-cream-sundae.jpg" -Force
Copy-Item "Fruit Salad.jpg" -Destination "creme-brulee.jpg" -Force

Write-Host "Images renamed successfully!" 