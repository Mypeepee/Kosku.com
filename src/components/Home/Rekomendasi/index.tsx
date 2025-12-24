"use client";
import Image from "next/image";
import { useRef } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Icon } from "@iconify/react";

const properties = [
  {
    id: 1,
    title: "Kosku Residence Premium",
    location: "Setiabudi, Jakarta Selatan",
    price: "Rp 2.500.000",
    discountPrice: "Rp 3.200.000",
    image: "/images/hero/banner-image.png", 
    tags: ["Campur", "WiFi", "AC", "K. Mandi Dalam"],
    badge: "Sisa 2 Kamar",
    rating: 4.8,
  },
  {
    id: 2,
    title: "Griya Mahasiswa UI",
    location: "Kukusan, Depok",
    price: "Rp 1.200.000",
    discountPrice: null,
    image: "/images/hero/banner-image.png",
    tags: ["Putra", "Dekat Kampus", "Parkir Luas"],
    badge: "Terlaris",
    rating: 4.5,
  },
  {
    id: 3,
    title: "Apartemen Kalibata City",
    location: "Pancoran, Jakarta Selatan",
    price: "Rp 4.000.000",
    discountPrice: "Rp 5.500.000",
    image: "/images/hero/banner-image.png",
    tags: ["Apartemen", "Kolam Renang", "Gym"],
    badge: "Promo Baru",
    rating: 4.9,
  },
  {
    id: 4,
    title: "Kos Putri Melati",
    location: "Gejayan, Yogyakarta",
    price: "Rp 850.000",
    discountPrice: "Rp 1.000.000",
    image: "/images/hero/banner-image.png",
    tags: ["Putri", "Murah", "Bersih"],
    badge: null,
    rating: 4.7,
  },
];

const Work = () => {
  const sliderRef = useRef<Slider>(null);

  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 2.5,
    slidesToScroll: 1,
    arrows: false,
    className: "center",
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1.1,
        },
      },
    ],
  };

  const next = () => {
    sliderRef.current?.slickNext();
  };
  const previous = () => {
    sliderRef.current?.slickPrev();
  };

  return (
    <div className="w-full bg-darkmode -mt-1 pt-1"> 
      {/* REVISI PENTING: pt-6 (Padding Top) dikurangi agar teks lebih naik mendekati kartu */}
      <section className="pb-20 pt-6 relative z-10" id="promo">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* BAGIAN KIRI */}
            <div className="lg:col-span-4 col-span-12">
              <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">
                Promo Spesial
              </span>
              <h2 className="text-white sm:text-5xl text-4xl font-bold leading-tight mb-6">
                Dapatkan <br />
                <span className="text-primary">Penawaran</span> <br />
                Terbaik Kami
              </h2>
              <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                Jelajahi berbagai pilihan hunian co-living dan kos eksklusif dengan harga miring khusus untuk Anda hari ini.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={previous}
                  className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center text-white hover:bg-primary hover:text-darkmode hover:border-primary transition-all duration-300"
                >
                  <Icon icon="solar:arrow-left-linear" width="24" />
                </button>
                <button
                  onClick={next}
                  className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center text-white hover:bg-primary hover:text-darkmode hover:border-primary transition-all duration-300"
                >
                  <Icon icon="solar:arrow-right-linear" width="24" />
                </button>
              </div>
            </div>

            {/* BAGIAN KANAN: Slider */}
            <div className="lg:col-span-8 col-span-12">
              <Slider ref={sliderRef} {...settings} className="property-slider">
                {properties.map((item) => (
                  <div key={item.id} className="px-3 pb-10 pt-2">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group h-full relative">
                      
                      <div className="relative h-56 w-full overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        {item.badge && (
                          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                            {item.badge}
                          </div>
                        )}
                        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-black text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                          <Icon icon="solar:star-bold" className="text-yellow-400" />
                          {item.rating}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
                          <Icon icon="solar:map-point-bold" className="text-primary" />
                          <span className="truncate">{item.location}</span>
                        </div>

                        <h3 className="text-darkmode text-xl font-bold mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <hr className="border-gray-100 mb-4" />

                        <div className="flex flex-col">
                           {item.discountPrice && (
                            <span className="text-gray-400 text-sm line-through decoration-red-500">
                              {item.discountPrice}
                            </span>
                          )}
                          <div className="flex items-end gap-1">
                            <span className="text-red-500 text-xl font-bold">
                              {item.price}
                            </span>
                            <span className="text-gray-400 text-sm mb-1">/ bulan</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                ))}
              </Slider>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Work;