#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Membangun ulang public/templates/TEMPLATE_DEBITURCARE.docx dari sumber ini.
#
# KENAPA DIBANGUN ULANG, BUKAN DISUNTING
# Template aslinya menata SEMUA kolom dengan tab (`<w:tab/>`) dan spasi manual:
# blok identitas, blok tanda tangan, bahkan kop surat. Tab hanya rapi selama
# teksnya sepanjang yang diketik pertama kali — begitu {{nama_debitur}} diganti
# nama asli yang lebih panjang, kolomnya melompat ke tab stop berikutnya dan
# baris tanda tangan berantakan. Nilai dari OCR panjangnya tidak pernah sama,
# jadi tata letak berbasis tab dijamin rusak. Tabel tanpa garis tidak bisa
# rusak seperti itu: sel yang kepanjangan membungkus ke bawah, kolom tetap.
#
# Selain itu: judul "PERJANJIAN JASA HUKUM" & semua "Pasal N" memakai gaya
# Heading1/Heading2 bawaan Word yang BIRU dan berfont Calibri Light, padahal
# seluruh badan surat Courier New hitam. Di sini gaya itu dinormalkan.
#
# CARA PAKAI:  python3 scripts/bangun-template-debiturcare.py
# Sumber gambar kop (word/media/image1.png) & theme diambil dari docx lama,
# jadi berkas lama harus tetap ada saat skrip dijalankan.
# ---------------------------------------------------------------------------
import re, shutil, sys, zipfile
from pathlib import Path
from xml.sax.saxutils import escape

AKAR = Path(__file__).resolve().parent.parent
DOCX = AKAR / "public/templates/TEMPLATE_DEBITURCARE.docx"

# ── Ukuran halaman (twips) ─────────────────────────────────────────────────
# A4 11900 x 16840, margin kiri/kanan 1440 → lebar isi 9020.
LEBAR_ISI = 9020

FONT = 'w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"'
SZ_BODY = 24        # 12pt — ukuran badan surat asli
SZ_TTD  = 20        # 10pt — label & nama di blok tanda tangan
SZ_NAMA = 18        # 9pt  — khusus nama advokat: 'SAROHA ORLANDO OKTAVIANUS
                    #        SIAHAAN, S.H.' 39 karakter, dan kolomnya kini
                    #        tepat setengah halaman

# ── Primitif XML ───────────────────────────────────────────────────────────

SP_BAKU = 'w:before="0" w:after="0" w:line="276" w:lineRule="auto"'

def rpr(b=False, u=False, sz=SZ_BODY, font=FONT, i=False):
    p = f'<w:rFonts {font}/>'
    if b: p += '<w:b/>'
    if i: p += '<w:i/>'
    if u: p += '<w:u w:val="single"/>'
    p += f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
    return f'<w:rPr>{p}</w:rPr>'

def run(teks, **kw):
    """Satu <w:r>. Teks placeholder SELALU utuh dalam satu <w:t> agar
    docxtemplater tidak perlu menyambung run yang terpecah."""
    out = ''
    for n, bagian in enumerate(teks.split('\n')):
        if n:
            out += '<w:br/>'
        out += f'<w:t xml:space="preserve">{escape(bagian)}</w:t>'
    return f'<w:r>{rpr(**kw)}{out}</w:r>'

def para(isi='', jc=None, ind=None, spacing=None, numid=None, ilvl=0,
         border_bawah=False, page_break=False, keep=False, **kw):
    p = ''
    if numid is not None:
        p += f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="{numid}"/></w:numPr>'
    if page_break:
        p += '<w:pageBreakBefore/>'
    if keep:
        p += '<w:keepNext/><w:keepLines/>'
    if border_bawah:
        p += ('<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" '
              'w:color="000000"/></w:pBdr>')
    sp = spacing or SP_BAKU
    p += f'<w:spacing {sp}/>'
    if ind:
        p += f'<w:ind {ind}/>'
    if jc:
        p += f'<w:jc w:val="{jc}"/>'
    if isi == '':
        # Tinggi baris kosong ditentukan oleh rPr tanda paragraf, bukan oleh run.
        return f'<w:p><w:pPr>{p}{rpr(**kw)}</w:pPr></w:p>'
    runs = isi if isi.startswith('<w:r') else run(isi, **kw)
    return f'<w:p><w:pPr>{p}</w:pPr>{runs}</w:p>'

def kosong(n=1, sz=SZ_BODY, spacing=None):
    """Baris kosong. `spacing` WAJIB disamakan dengan baris teks di sekitarnya
    kalau dipakai di dalam kolom yang harus sejajar: baris kosong bawaan memakai
    line 240 sedangkan baris teks 276, jadi kolom yang punya lebih banyak baris
    kosong naik ~36 twips per baris — cukup untuk membuat dua nama penanda
    tangan yang seharusnya sebaris terlihat meleset."""
    sp = spacing or 'w:before="0" w:after="0" w:line="240" w:lineRule="auto"'
    return ''.join(para('', spacing=sp, sz=sz) for _ in range(n))

# ── Tabel tanpa garis ──────────────────────────────────────────────────────

def tabel(baris, lebar, indent=0, va='top'):
    """baris: list of list of str (XML paragraf per sel). lebar: list int (twips)."""
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in lebar)
    pr = (f'<w:tblPr><w:tblW w:w="{sum(lebar)}" w:type="dxa"/>'
          + (f'<w:tblInd w:w="{indent}" w:type="dxa"/>' if indent else '')
          + '<w:tblBorders>'
          + ''.join(f'<w:{s} w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                    for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
          + '</w:tblBorders>'
            '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>'
            '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
            '<w:tblLayout w:type="fixed"/></w:tblPr>')
    out = f'<w:tbl>{pr}<w:tblGrid>{grid}</w:tblGrid>'
    for r in baris:
        out += '<w:tr><w:trPr><w:cantSplit/></w:trPr>'
        for i, sel in enumerate(r):
            out += (f'<w:tc><w:tcPr><w:tcW w:w="{lebar[i]}" w:type="dxa"/>'
                    f'<w:vAlign w:val="{va}"/></w:tcPr>{sel or para("")}</w:tc>')
        out += '</w:tr>'
    return out + '</w:tbl>'

def blok_identitas(pasangan, indent=720, tebal_nilai=True, nomor=None):
    """Tabel 'Label : Nilai'. Inilah pengganti tumpukan <w:tab/> yang dulu
    membuat kolom titik dua melompat begitu nilainya berubah panjang."""
    L_NO, L_LAB, L_TITIK = (420 if nomor else 0), 2700, 300
    l_nilai = LEBAR_ISI - indent - L_NO - L_LAB - L_TITIK
    lebar = ([L_NO] if nomor else []) + [L_LAB, L_TITIK, l_nilai]
    sp = 'w:before="0" w:after="0" w:line="276" w:lineRule="auto"'
    baris = []
    for n, (label, nilai) in enumerate(pasangan):
        sel = []
        if nomor:
            sel.append(para(nomor if n == 0 else '', spacing=sp))
        sel += [
            para(label, spacing=sp),
            para(':', spacing=sp),
            para(nilai, spacing=sp, b=tebal_nilai),
        ]
        baris.append(sel)
    return tabel(baris, lebar, indent=indent)

def blok_ttd(kiri, kanan):
    """Dua kolom tanda tangan, dibagi TEPAT SEPARUH.

    Sebelumnya kolom kiri 3900 dari 9020 twips, jadi kolom kanan mulai di 43%
    halaman — cukup meleset dari tengah untuk terbaca sebagai kolom kiri yang
    melebar, seolah pihak pertama memakan ruang pihak kedua. Separuh tepat
    menghilangkan kesan itu. Konsekuensinya nama advokat terpanjang harus turun
    ke 9pt supaya tetap muat satu baris; nama yang membungkus di atas garis
    tanda tangan jauh lebih jelek daripada nama yang sedikit lebih kecil."""
    separuh = LEBAR_ISI // 2
    return tabel([[''.join(kiri), ''.join(kanan)]], [separuh, LEBAR_ISI - separuh])

# ── Kop surat ──────────────────────────────────────────────────────────────

def kop():
    # Logo dibuat INLINE di dalam sel tabel. Versi lama memakai gambar
    # mengambang (anchor) lalu mendorong teks dengan spasi manual — teks dan
    # logo saling tindih begitu ukuran font atau teksnya berubah sedikit saja.
    gambar = (
        '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>'
        '<wp:inline distT="0" distB="0" distL="0" distR="0">'
        '<wp:extent cx="1604865" cy="1362270"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
        '<wp:docPr id="1" name="Logo Justicia Law Firm" descr="Logo Justicia Law Firm"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>'
        '</wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:nvPicPr><pic:cNvPr id="0" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr>'
        '<pic:blipFill><a:blip r:embed="rId5"/>'
        '<a:srcRect l="39071" t="20918" r="42826" b="6122"/><a:stretch/></pic:blipFill>'
        '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/>'
        '<a:ext cx="1604865" cy="1362270"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>'
        '</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    )
    TNR  = 'w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"'
    ARIA = 'w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"'
    sp = 'w:before="0" w:after="0" w:line="240" w:lineRule="auto"'
    kiri  = para(gambar, jc='center', spacing=sp)
    kanan = (
        para('JUSTICIA LAW FIRM',                 jc='center', spacing=sp, font=TNR, b=True, sz=50)
        + para('Kantor Advokat & Kurator Kepailitan', jc='center', spacing=sp, font=TNR, sz=30)
        + para('Kuasa Hukum Pajak & Konsultan Pajak', jc='center', spacing=sp, font=TNR, sz=30)
        + para('Santorini Townsquare – Suite Olympus', jc='center', spacing=sp, font=ARIA, sz=20)
        + para('Jl. Ronggolawe 2A, Kel. Dr. Soetomo, Kec. Tegalsari, Surabaya',
               jc='center', spacing=sp, font=ARIA, sz=20)
        + para('www.justicia.web.id', jc='center', spacing=sp, font=ARIA, b=True, sz=20)
    )
    # Garis pemisah: border paragraf, bukan deretan karakter "_" yang
    # panjangnya tidak pernah pas dengan lebar halaman.
    return (tabel([[kiri, kanan]], [2760, LEBAR_ISI - 2760], va='center')
            + para('', border_bawah=True, spacing='w:before="40" w:after="120" w:line="240" w:lineRule="auto"', sz=4))

# ── Isi dokumen ────────────────────────────────────────────────────────────

ADVOKAT = ['SAROHA ORLANDO OKTAVIANUS SIAHAAN, S.H.',
           'VENATHA TANOTO, S.H., M.Kn.',
           'MARKUS DIYANTO LIE']

# Paralegal dipisahkan dari daftar advokat, bukan sekadar ditambahkan ke
# bawahnya. Kuasa diberikan KEPADA ADVOKAT; menyebut paralegal di dalam daftar
# penerima kuasa membuat surat ini keliru secara hukum, bukan cuma tidak rapi.
# Ia disebut sebagai pihak yang MEMBANTU, dan di blok tanda tangan namanya
# diberi keterangan jabatan supaya tidak terbaca sebagai advokat keempat.
PARALEGAL = ['JASON CHRISTOPHER LIENDO']

JUSTIFY = 'w:left="0" w:right="0"'
SP_ISI  = 'w:before="0" w:after="120" w:line="276" w:lineRule="auto"'

def surat_kuasa():
    x = kop()
    x += para('SURAT KUASA', jc='center', b=True, u=True, sz=28,
              spacing='w:before="120" w:after="240" w:line="240" w:lineRule="auto"')
    x += para('Yang bertanda-tangan di bawah ini :', spacing=SP_ISI)
    x += blok_identitas([
        ('Nama',            '{{nama_debitur}}'),
        ('Nomor Induk KTP', '{{NIK}}'),
        ('Tempat/Tgl Lahir','{{tempat_tanggal_lahir}}'),
        ('Jenis Kelamin',   '{{kelamin}}'),
        ('Warga Negara',    '{{warga_negara}}'),
        ('Alamat',          '{{alamat_lengkap}}'),
        ('Pekerjaan',       '{{pekerjaan}}'),
        ('Status',          '{{status_kawin}}'),
    ])
    x += kosong(1)
    x += para('Untuk selanjutnya disebut sebagai ------------ PEMBERI KUASA;',
              spacing=SP_ISI)
    x += para('Dengan ini menerangkan, memilih kediaman hukum di tempat kuasanya yang tersebut '
              'di bawah ini dan memberikan kuasa penuh dengan hak substitusi dan hak retensi '
              'kepada para advokat warga negara Indonesia :', jc='both', spacing=SP_ISI)
    for nama in ADVOKAT:
        x += para(nama, jc='center', b=True,
                  spacing='w:before="0" w:after="0" w:line="276" w:lineRule="auto"')
    x += kosong(1)
    x += para('Kesemuanya adalah Para Advokat dan Penasehat Hukum yang tergabung pada Kantor '
              'Hukum “JUSTICIA LAW FIRM” yang beralamat kantor di Santorini Townsquare – Suite '
              'Olympus – Jl. Ronggolawe 2A - Surabaya – Jawa Timur, yang dalam menjalankan kuasa '
              'ini dibantu oleh paralegal :', jc='both', spacing=SP_ISI)
    for nama in PARALEGAL:
        x += para(nama, jc='center', b=True,
                  spacing='w:before="0" w:after="0" w:line="276" w:lineRule="auto"')
    x += kosong(1)
    x += para('bertindak untuk dan atas nama Pemberi Kuasa :', jc='both', spacing=SP_ISI)
    x += para('Untuk selanjutnya disebut sebagai ----------- PENERIMA KUASA;',
              spacing=SP_ISI)
    x += para('KHUSUS', jc='center', b=True, u=True,
              spacing='w:before="120" w:after="180" w:line="240" w:lineRule="auto"')
    x += para('Bertindak untuk dan atas nama Pemberi Kuasa mewakili untuk upaya mediasi dengan '
              'pihak pemenang lelang/Cessor/pihak lainnya, menyusun dan mengirimkan Surat '
              'Permohonan, Somasi, dokumen terkait lainnya, termasuk mendaftarkan gugatan di '
              'Pengadilan Negeri Surabaya berkaitan dengan :',
              jc='both', spacing=SP_ISI)
    x += para('Negosiasi Biaya Kompensasi Pengosongan Rumah Tinggal, termasuk menerima '
              'pembayarannya;', jc='both', numid=1, spacing=SP_ISI)
    x += para('Teknis Pengosongan termasuk proses pemindahan barang dari rumah yang beralamat '
              'di {{alamat_lengkap}} dengan jenis sertifikat {{jenis_sertifikat}} '
              'No : {{nomor_sertifikat}};', jc='both', numid=1, spacing=SP_ISI)
    x += para('Untuk itu Penerima Kuasa diberi hak :',
              jc='both', spacing=SP_ISI)
    for t in [
        'Bertindak untuk dan atas nama Pemberi Kuasa MEWAKILI kepentingan hukum Pemberi Kuasa '
        'untuk membuat dan menandatangani Surat Kuasa dan dokumen hukum lainnya yang berkaitan '
        'atas nama Pemberi Kuasa;',
        'Sehubungan dengan hal tersebut di atas, Penerima Kuasa berhak untuk memberikan '
        'keterangan sanggahan dan/atau jawaban, mengadakan pertemuan dan perundingan-'
        'perundingan, menghadap, membuat dan mengirim pengaduan kepada instansi terkait, serta '
        'mengadakan perdamaian dengan persetujuan lebih dahulu dari Pemberi Kuasa;',
        'Singkat kata Penerima Kuasa dapat mempertahankan kepentingan Pemberi Kuasa yang '
        'dianggap baik dan berguna sehubungan dengan menjalankan kuasa serta dapat mengerjakan '
        'segala sesuatu pekerjaan yang umumnya dapat dilakukan oleh seorang penerima kuasa '
        'untuk kepentingan di atas;',
        'Pemberi Kuasa dengan ini pula menjamin bahwa apa yang dilakukan oleh Penerima Kuasa '
        'dalam perkara ini adalah seperti tindakan dan perbuatan langsung dari Pemberi Kuasa '
        'dan oleh karenanya membebaskan Penerima Kuasa dari “SEGALA TUNTUTAN HUKUM” sehubungan '
        'dengan penanganan perkara tersebut (acquit et de charge);',
        'Kuasa ini diberikan secara tegas dengan hak retensi dan hak untuk melimpahkan wewenang '
        'baik sebagian maupun seluruhnya kepada Advokat (recht van substitutie) serta hak untuk '
        'menarik kembali wewenang yang dilimpahkan tersebut;',
    ]:
        x += para(t, jc='both', spacing=SP_ISI)

    # Kalimat penutup DIPAKSA menempel pada blok tanda tangan (keepNext).
    # Tanpa ini halaman tanda tangan berisi tanda tangan saja dan terbaca
    # seperti lembar yang tercecer; dengan ini ia jadi halaman penutup yang
    # utuh — kalimat penutup lalu tanda tangannya.
    x += para('Demikian surat kuasa ini diberikan agar dapat dipergunakan sebagaimana mestinya;',
              jc='both', spacing=SP_ISI, keep=True)

    # ── Tanda tangan ──
    sp_ttd = 'w:before="0" w:after="0" w:line="276" w:lineRule="auto"'
    kiri = [
        para('SURABAYA, {{tanggal}}', b=True, sz=SZ_TTD, spacing=sp_ttd),
        para('PEMBERI KUASA,',        b=True, sz=SZ_TTD, spacing=sp_ttd),
        kosong(1, sz=SZ_TTD, spacing=sp_ttd),
        para('Meterai 10.000', sz=SZ_TTD, spacing=sp_ttd),
        kosong(3, sz=SZ_TTD, spacing=sp_ttd),
        para('{{nama_debitur}}', b=True, u=True, sz=SZ_TTD, spacing=sp_ttd),
    ]
    # Tiga advokat = TIGA ruang tanda tangan, bukan tiga nama bertumpuk di bawah
    # satu ruang. Versi sebelumnya menuntut tiga orang membubuhkan tanda tangan
    # di tempat yang sama.
    kanan = [
        para('', sz=SZ_TTD, spacing=sp_ttd),
        para('PENERIMA KUASA,', b=True, sz=SZ_TTD, spacing=sp_ttd),
    ]
    for n, nama_advokat in enumerate(ADVOKAT):
        # Advokat pertama sengaja sebaris dengan nama Pemberi Kuasa di kolom
        # kiri; sisanya menyusul dengan jarak tanda tangan yang sama.
        # Spacer tetap 10pt walau namanya 9pt: kalau ikut mengecil, tujuh baris
        # kosong di kolom kanan jadi lebih pendek daripada kolom kiri dan nama
        # advokat pertama melayang di atas nama Pemberi Kuasa.
        kanan.append(kosong(5 if n == 0 else 3, sz=SZ_TTD, spacing=sp_ttd))
        kanan.append(para(nama_advokat, b=True, u=True, sz=SZ_NAMA, spacing=sp_ttd))
    for nama_paralegal in PARALEGAL:
        kanan.append(kosong(3, sz=SZ_TTD, spacing=sp_ttd))
        kanan.append(para(nama_paralegal, b=True, u=True, sz=SZ_NAMA, spacing=sp_ttd))
        # Keterangan jabatan di bawah nama: satu-satunya penanda bahwa ia bukan
        # advokat keempat yang ikut menerima kuasa.
        kanan.append(para('Paralegal', sz=SZ_NAMA, spacing=sp_ttd))
    x += para('', spacing=SP_ISI, keep=True)
    x += blok_ttd(kiri, kanan)
    return x

def perjanjian():
    x = para('PERJANJIAN JASA HUKUM', jc='center', b=True, u=True, sz=28, page_break=True,
             spacing='w:before="0" w:after="60" w:line="240" w:lineRule="auto"')
    x += para('Nomor: {{nomor_surat}}', jc='center', b=True,
              spacing='w:before="0" w:after="240" w:line="240" w:lineRule="auto"')
    x += para('Pada hari ini, {{hari}}, tanggal {{tanggal}}, yang bertanda tangan di bawah ini:',
              jc='both', spacing=SP_ISI)
    x += blok_identitas([
        ('Nama',                 '{{nama_debitur}}'),
        ('Tempat/Tgl Lahir', '{{tempat_tanggal_lahir}}'),
        ('Alamat',               '{{alamat_lengkap}}'),
        ('No. KTP',              '{{NIK}}'),
    ], indent=360, nomor='1.')
    x += kosong(1)
    x += para(run('Dalam Perjanjian ini bertindak untuk dan atas nama diri sendiri, '
                  'selanjutnya disebut sebagai ') + run('PIHAK KESATU;', b=True),
              jc='both', ind='w:left="720"', spacing=SP_ISI)
    x += blok_identitas([
        ('Nama',                 'MARKUS DIYANTO LIE'),
        ('Tempat/Tgl Lahir', 'Surabaya, 12 Desember 1976'),
        ('Alamat',               'Santorini Townsquare – Suite 19, Kel. Dr. Soetomo, '
                                 'Kec. Tegalsari, Kota Surabaya'),
        ('No. KTP',              '3578 0612 1276 0007'),
    ], indent=360, nomor='2.')
    x += kosong(1)
    x += para(run('Dalam Perjanjian ini bertindak atas nama Kantor Hukum JUSTICIA LAW FIRM, '
                  'selanjutnya disebut sebagai ') + run('PIHAK KEDUA;', b=True),
              jc='both', ind='w:left="720"', spacing=SP_ISI)
    x += para('Para pihak dengan ini sepakat untuk mengikatkan diri dalam perjanjian jasa hukum '
              'dengan ketentuan sebagai berikut:', jc='both', spacing=SP_ISI)

    def pasal(no, judul):
        sp = 'w:before="240" w:after="0" w:line="240" w:lineRule="auto"'
        return (para(f'Pasal {no}', jc='center', b=True, spacing=sp, keep=True)
                + para(judul, jc='center', b=True, keep=True,
                       spacing='w:before="0" w:after="180" w:line="240" w:lineRule="auto"'))

    x += pasal(1, 'RUANG LINGKUP JASA HUKUM')
    x += para('PIHAK KEDUA diberikan kuasa untuk menangani dan mewakili kepentingan hukum PIHAK '
              'KESATU dalam menunjuk advokat untuk kepentingan upaya mediasi dengan pihak '
              'pemenang lelang/Cessor/pihak lainnya, menyusun dan mengirimkan Surat Permohonan, '
              'Somasi, dokumen terkait lainnya, menghadap bank untuk menyelesaikan hutang, '
              'termasuk mendaftarkan gugatan di Pengadilan Negeri Surabaya berkaitan dengan :',
              jc='both', spacing=SP_ISI)
    x += para('Negosiasi Biaya Kompensasi Pengosongan Rumah Tinggal, termasuk menerima '
              'pembayarannya;', jc='both', numid=2, spacing=SP_ISI)
    x += para('Teknis Pengosongan termasuk proses pemindahan barang dari rumah yang beralamat '
              'di {{alamat_lengkap}} dengan jenis sertifikat {{jenis_sertifikat}} '
              'No : {{nomor_sertifikat}};', jc='both', numid=2, spacing=SP_ISI)

    x += pasal(2, 'PEMBAYARAN JASA')
    x += para('Jasa hukum yang diberikan oleh PIHAK KEDUA akan dibayarkan dengan dua skema '
              'sebagai berikut:', jc='both', numid=3, spacing=SP_ISI)
    x += para('Apabila PIHAK KESATU berhasil mempertahankan aset yang dimaksud melalui '
              'penyelesaian sendiri dengan pihak bank (melunasi hutang), maka PIHAK KESATU wajib '
              'membayar jasa hukum kepada PIHAK KEDUA sebesar Rp 25.000.000,- (dua puluh lima '
              'juta rupiah);', jc='both', numid=3, ilvl=1, spacing=SP_ISI)
    x += para('Apabila proses lelang tetap berlangsung dan aset dimenangkan oleh pihak ketiga '
              '(pemenang lelang), maka PIHAK KEDUA akan mewakili PIHAK KESATU untuk melakukan '
              'pendekatan, mediasi, dan/atau permintaan kompensasi kepada pihak pemenang lelang. '
              'Atas kompensasi yang berhasil diperoleh dari pihak pemenang lelang tersebut, '
              'PIHAK KESATU wajib memberikan 30% (tiga puluh persen) dari total kompensasi '
              'kepada PIHAK KEDUA sebagai jasa hukum;', jc='both', numid=3, ilvl=1, spacing=SP_ISI)
    x += para('Persentase yang disepakati adalah sebesar 30% (tiga puluh persen) dari nilai '
              'kompensasi yang diperoleh oleh PIHAK KESATU setelah dikurangi seluruh biaya-biaya '
              'pelaksanaan;', jc='both', numid=3, spacing=SP_ISI)
    x += para('Pembayaran sebagaimana dimaksud dalam ayat (1) dilakukan dalam waktu / hari yang '
              'sama setelah hasil diterima secara nyata, baik berupa uang, aset, atau hak '
              'tertentu;', jc='both', numid=3, spacing=SP_ISI)

    x += pasal(3, 'BIAYA OPERASIONAL')
    x += para('Semua biaya-biaya operasional perkara ditanggung oleh PIHAK KEDUA;',
              jc='both', numid=4, spacing=SP_ISI)
    x += para('PIHAK KEDUA membebaskan PIHAK KESATU dari semua biaya operasional perkara yang '
              'ditangani;', jc='both', numid=4, spacing=SP_ISI)

    x += pasal(4, 'KEWAJIBAN DAN HAK PARA PIHAK')
    x += para('PIHAK KESATU wajib memberikan dokumen dan informasi yang akurat, menandatangani '
              'kuasa dan dokumen lainnya yang diperlukan oleh PIHAK KEDUA untuk penanganan '
              'perkara, serta tidak menghambat/memperlambat proses penanganan perkara;',
              jc='both', numid=5, spacing=SP_ISI)
    x += para('PIHAK KEDUA wajib mengarahkan advokat yang ditunjuk untuk memberikan pendampingan '
              'dan pembelaan hukum secara profesional dan beritikad baik;',
              jc='both', numid=5, spacing=SP_ISI)
    x += para('PIHAK KEDUA berhak menarik diri jika terdapat pelanggaran berat oleh PIHAK '
              'KESATU;', jc='both', numid=5, spacing=SP_ISI)

    x += pasal(5, 'KETENTUAN LAIN')
    x += para('Kuasa hukum yang diberikan PIHAK KESATU kepada advokat yang ditunjuk oleh PIHAK '
              'KEDUA tidak dapat dicabut, dibatalkan, maupun dialihkan secara sepihak oleh PIHAK '
              'KESATU, selama perkara belum selesai dan/atau selama PIHAK KEDUA belum menerima '
              'haknya sebagaimana disepakati dalam Pasal 2;', jc='both', numid=6, spacing=SP_ISI)
    x += para('Pencabutan atau pembatalan kuasa hanya dapat dilakukan apabila PIHAK KESATU telah '
              'menyelesaikan seluruh kewajibannya, termasuk pembayaran jasa hukum berdasarkan '
              'sistem bagi hasil sesuai Pasal 2;', jc='both', numid=6, spacing=SP_ISI)
    x += para('Apabila PIHAK KESATU tetap melakukan pembatalan atau pencabutan kuasa secara '
              'sepihak tanpa melaksanakan kewajibannya, maka:', jc='both', numid=6, spacing=SP_ISI)
    x += para('PIHAK KESATU tetap wajib membayar hak bagi hasil PIHAK KEDUA sebagaimana yang '
              'telah disepakati, dan jika belum ada ganti rugi yang diterima sepakat mengganti '
              'biaya operasional PIHAK KEDUA sebesar Rp 25.000.000,- (dua puluh lima juta '
              'rupiah) atau 30% (tiga puluh persen) dari nilai pembayaran ganti rugi yang '
              'ternyata telah diterima oleh PIHAK KESATU;', jc='both', numid=6, ilvl=1, spacing=SP_ISI)
    x += para('Jika ketentuan pada huruf (a) tidak dilaksanakan, tindakan tersebut akan dianggap '
              'sebagai wanprestasi dan PIHAK KEDUA berhak untuk menempuh jalur hukum guna '
              'menuntut pemenuhan haknya;', jc='both', numid=6, ilvl=1, spacing=SP_ISI)
    x += para('Ketentuan ini mengikat sebagai bentuk perlindungan hukum terhadap hubungan '
              'profesional antara PIHAK KESATU dan PIHAK KEDUA, serta sebagai jaminan atas '
              'imbalan jasa hukum yang sah dan wajar;', jc='both', numid=6, ilvl=1, spacing=SP_ISI)

    x += pasal(6, 'JANGKA WAKTU')
    x += para('Kesepakatan ini berlaku sejak tanggal ditandatangani sampai semua kewajiban '
              'masing-masing pihak terpenuhi.', jc='both', spacing=SP_ISI)

    x += pasal(7, 'PENYELESAIAN SENGKETA')
    x += para('Segala perselisihan akan diselesaikan terlebih dahulu secara musyawarah;',
              jc='both', numid=7, spacing=SP_ISI)
    x += para('Jika tidak tercapai, para pihak sepakat untuk menyelesaikan sengketa melalui '
              'Kantor Kepaniteraan Pengadilan Negeri Surabaya;', jc='both', numid=7, spacing=SP_ISI)

    x += kosong(1)
    x += para('Demikian Perjanjian Jasa Hukum ini dibuat dengan sebenarnya, dan ditandatangani '
              'dalam dua rangkap bermeterai cukup yang memiliki kekuatan hukum yang sama untuk '
              'dipergunakan sebagaimana mestinya.', jc='both', spacing=SP_ISI, keep=True)
    x += para('', spacing=SP_ISI, keep=True)

    sp_ttd = 'w:before="0" w:after="0" w:line="276" w:lineRule="auto"'
    kiri = [
        para('PIHAK KESATU', b=True, sz=SZ_TTD, spacing=sp_ttd),
        kosong(1, sz=SZ_TTD, spacing=sp_ttd),
        para('Meterai 10.000', sz=SZ_TTD, spacing=sp_ttd),
        kosong(3, sz=SZ_TTD, spacing=sp_ttd),
        para('{{nama_debitur}}', b=True, u=True, sz=SZ_TTD, spacing=sp_ttd),
    ]
    kanan = [
        para('PIHAK KEDUA', b=True, sz=SZ_TTD, spacing=sp_ttd),
        kosong(5, sz=SZ_TTD, spacing=sp_ttd),
        para('MARKUS DIYANTO LIE', b=True, u=True, sz=SZ_TTD, spacing=sp_ttd),
    ]
    x += blok_ttd(kiri, kanan)
    return x

# ── Rakit part XML ─────────────────────────────────────────────────────────

NS = ('xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
      'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
      'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
      'mc:Ignorable="w14"')

def document_xml():
    # footerReference WAJIB mendahului pgSz — urutan anak sectPr diatur skema,
    # dan Word menolak berkasnya kalau terbalik (LibreOffice diam saja).
    sect = ('<w:sectPr>'
            f'<w:footerReference w:type="default" r:id="{RID_FOOTER}"/>'
            '<w:pgSz w:w="11900" w:h="16840"/>'
            '<w:pgMar w:top="567" w:right="1440" w:bottom="1134" w:left="1440" '
            'w:header="708" w:footer="708" w:gutter="0"/>'
            '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>')
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
            + NS + '><w:body>' + surat_kuasa() + perjanjian() + sect + '</w:body></w:document>')

RID_FOOTER = "rId100"   # jauh dari rId1-8 bawaan berkas asli

def footer_xml():
    """Nomor halaman di kaki tiap halaman.

    Surat kuasa & perjanjian ini tujuh halaman dan akan ditandatangani basah
    lalu difotokopi. Tanpa nomor halaman, satu lembar yang tertukar atau hilang
    tidak akan pernah ketahuan — dan itu justru jenis kecerobohan yang paling
    cepat dilihat penerimanya.

    Dipakai `fldSimple` PAGE/NUMPAGES, bukan angka mati: nomornya ikut menyesuaikan
    kalau isi surat membuat jumlah halaman berubah.
    """
    rpr = f'<w:rPr><w:rFonts {FONT}/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="595959"/></w:rPr>'
    def r(t):
        return f'<w:r>{rpr}<w:t xml:space="preserve">{t}</w:t></w:r>'
    def fld(instr, contoh):
        return f'<w:fldSimple w:instr=" {instr} "><w:r>{rpr}<w:t>{contoh}</w:t></w:r></w:fldSimple>'
    par = ('<w:p><w:pPr><w:jc w:val="center"/>'
           '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'
           f'{rpr}</w:pPr>'
           + r('Halaman ') + fld('PAGE', '1') + r(' dari ') + fld('NUMPAGES', '1')
           + '</w:p>')
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:ftr xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
            + NS + '>' + par + '</w:ftr>')


def numbering_xml():
    # Satu definisi abstrak, dipakai ulang oleh beberapa numId. Tiap numId
    # memakai startOverride agar daftarnya mulai dari 1 lagi — kalau tidak,
    # penomoran Pasal 3 melanjutkan hitungan Pasal 2.
    lvl = ''
    for i, (fmt, teks) in enumerate([('decimal', '%1.'), ('lowerLetter', '%2.'),
                                     ('lowerRoman', '%3.')]):
        kiri = 720 + i * 720
        lvl += (f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="{fmt}"/>'
                f'<w:lvlText w:val="{teks}"/><w:lvlJc w:val="left"/>'
                f'<w:pPr><w:ind w:left="{kiri}" w:hanging="360"/></w:pPr>'
                f'<w:rPr><w:rFonts {FONT}/></w:rPr></w:lvl>')
    for i in range(3, 9):
        lvl += (f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="decimal"/>'
                f'<w:lvlText w:val="%{i+1}."/><w:lvlJc w:val="left"/>'
                f'<w:pPr><w:ind w:left="{720 + i * 720}" w:hanging="360"/></w:pPr></w:lvl>')
    num = ''
    for n in range(1, 9):
        ov = ''.join(f'<w:lvlOverride w:ilvl="{i}"><w:startOverride w:val="1"/></w:lvlOverride>'
                     for i in range(3))
        num += f'<w:num w:numId="{n}"><w:abstractNumId w:val="0"/>{ov}</w:num>'
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:numbering xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
            + NS + '>'
            '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/>'
            + lvl + '</w:abstractNum>' + num + '</w:numbering>')

def styles_xml(asli):
    """Heading1/Heading2 bawaan Word berwarna biru & berfont Calibri Light —
    di badan surat Courier New hitam itu tampak seperti salah tempel. Judul
    dokumen kini memakai run eksplisit, tapi gayanya tetap dinormalkan agar
    apa pun yang menyentuh template ini tidak memunculkan biru itu lagi."""
    out = asli
    # Font baku dokumen → Courier New, agar teks tanpa rFonts tidak jatuh ke Calibri.
    out = out.replace(
        '<w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" '
        'w:eastAsiaTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>',
        f'<w:rPrDefault><w:rPr><w:rFonts {FONT}/>')
    for sid in ('Heading1', 'Heading2'):
        m = re.search(r'<w:style [^>]*w:styleId="%s".*?</w:style>' % sid, out, re.S)
        if not m:
            continue
        blok = m.group(0)
        bersih = re.sub(r'<w:color w:val="[^"]*"[^/]*/>', '<w:color w:val="000000"/>', blok)
        bersih = re.sub(r'<w:rFonts w:asciiTheme="majorHAnsi"[^/]*/>', f'<w:rFonts {FONT}/>', bersih)
        bersih = re.sub(r'<w:sz w:val="\d+"/>', f'<w:sz w:val="{SZ_BODY}"/>', bersih)
        bersih = re.sub(r'<w:szCs w:val="\d+"/>', f'<w:szCs w:val="{SZ_BODY}"/>', bersih)
        out = out.replace(blok, bersih)
    return out

# ── Tulis docx ─────────────────────────────────────────────────────────────

def main():
    if not DOCX.exists():
        sys.exit(f"Template sumber tidak ditemukan: {DOCX}")
    # Salinan asli disimpan DI LUAR public/: apa pun di public/ ikut terunggah
    # dan bisa diunduh siapa saja, dan berkas cadangan tidak punya urusan di sana.
    cadangan = AKAR / "scripts/asal/TEMPLATE_DEBITURCARE.docx"
    sumber = cadangan if cadangan.exists() else DOCX
    if not cadangan.exists():
        cadangan.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DOCX, cadangan)
        print(f"→ salinan asli disimpan: {cadangan.relative_to(AKAR)}")

    baru = {}
    with zipfile.ZipFile(sumber) as z:
        for it in z.namelist():
            baru[it] = z.read(it)

    # Footer perlu tiga pendaftaran terpisah: berkasnya sendiri, relasi dari
    # document.xml, dan tipe konten di manifes. Lupa salah satu → berkas rusak.
    baru['word/footer1.xml'] = footer_xml().encode('utf-8')

    rels = baru['word/_rels/document.xml.rels'].decode('utf-8')
    if RID_FOOTER not in rels:
        rels = rels.replace('</Relationships>',
            f'<Relationship Id="{RID_FOOTER}" Type="http://schemas.openxmlformats.org/'
            'officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>')
        baru['word/_rels/document.xml.rels'] = rels.encode('utf-8')

    ct = baru['[Content_Types].xml'].decode('utf-8')
    if 'footer1.xml' not in ct:
        ct = ct.replace('</Types>',
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.'
            'openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
        baru['[Content_Types].xml'] = ct.encode('utf-8')

    baru['word/document.xml']  = document_xml().encode('utf-8')
    baru['word/numbering.xml'] = numbering_xml().encode('utf-8')
    baru['word/styles.xml']    = styles_xml(baru['word/styles.xml'].decode('utf-8')).encode('utf-8')

    with zipfile.ZipFile(DOCX, 'w', zipfile.ZIP_DEFLATED) as z:
        for nama, isi in baru.items():
            z.writestr(nama, isi)

    teks = document_xml()
    ph = sorted(set(re.findall(r'\{\{(\w+)\}\}', teks)))
    print(f"✓ {DOCX.relative_to(AKAR)} ditulis ulang ({DOCX.stat().st_size:,} byte)")
    print(f"  paragraf : {teks.count('<w:p>')}   tabel: {teks.count('<w:tbl>')}")
    print(f"  placeholder ({len(ph)}): " + ", ".join(ph))

if __name__ == '__main__':
    main()
