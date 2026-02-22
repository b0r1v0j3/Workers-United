Add-Type -AssemblyName System.IO.Compression.FileSystem

$docxPath = Join-Path $PSScriptRoot "..\public\templates\pozivno-pismo-pravno-lice.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xmlText = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

[xml]$doc = $xmlText
$body = $doc.document.body

$lineNum = 1
foreach ($node in $body.ChildNodes) {
    if ($node.LocalName -eq "p") {
        $texts = @()
        foreach ($r in $node.ChildNodes) {
            if ($r.LocalName -eq "r") {
                foreach ($child in $r.ChildNodes) {
                    if ($child.LocalName -eq "t") {
                        $texts += $child.InnerText
                    }
                }
            }
        }
        $line = ($texts -join "").Trim()
        if ($line.Length -gt 0) {
            Write-Output "${lineNum}: $line"
            $lineNum++
        }
    }
    elseif ($node.LocalName -eq "tbl") {
        Write-Output "${lineNum}: [TABLE START]"
        $lineNum++
        foreach ($row in $node.ChildNodes) {
            if ($row.LocalName -eq "tr") {
                $cells = @()
                foreach ($cell in $row.ChildNodes) {
                    if ($cell.LocalName -eq "tc") {
                        $cellTexts = @()
                        foreach ($p in $cell.ChildNodes) {
                            if ($p.LocalName -eq "p") {
                                foreach ($r in $p.ChildNodes) {
                                    if ($r.LocalName -eq "r") {
                                        foreach ($child in $r.ChildNodes) {
                                            if ($child.LocalName -eq "t") {
                                                $cellTexts += $child.InnerText
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        $cells += ($cellTexts -join "")
                    }
                }
                Write-Output "${lineNum}: | $($cells -join ' | ') |"
                $lineNum++
            }
        }
        Write-Output "${lineNum}: [TABLE END]"
        $lineNum++
    }
}
